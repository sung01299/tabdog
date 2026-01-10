//
//  AppDelegate.swift
//  TabDog
//
//  NSStatusItem + NSPopover implementation for reliable multi-monitor positioning.
//

import AppKit
import SwiftUI
import Carbon

final class AppDelegate: NSObject, NSApplicationDelegate {
    // Shared VM for the whole app (popover + settings)
    let viewModel = TabViewModel()

    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var iconUpdateTimer: Timer?
    
    // MARK: - Global Hotkey
    // Default: Cmd + Shift + D (easy mnemonic: Doggy)
    private let hotKeyId = EventHotKeyID(signature: OSType("TDOG".fourCharCodeValue), id: 1)
    private var hotKeyRef: EventHotKeyRef?
    private var hotKeyHandlerRef: EventHandlerRef?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Keep the app out of the Dock (menu bar app behavior)
        NSApp.setActivationPolicy(.accessory)

        setupStatusItem()
        setupPopover()
        registerGlobalHotkey()
        
        // Initialize launch at login (enables by default on first launch)
        _ = LaunchAtLoginService.shared

        // Start background polling immediately
        viewModel.startPolling()

        // Update status icon periodically (simple + reliable across @Observable updates)
        iconUpdateTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.updateStatusItem()
        }
        updateStatusItem()
    }

    func applicationWillTerminate(_ notification: Notification) {
        iconUpdateTimer?.invalidate()
        unregisterGlobalHotkey()
    }

    // MARK: - Setup

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        guard let button = statusItem.button else { return }
        button.target = self
        button.action = #selector(togglePopover(_:))
        button.sendAction(on: [.leftMouseUp])
    }

    private func setupPopover() {
        popover = NSPopover()
        popover.behavior = .transient
        popover.animates = true
        popover.contentSize = NSSize(width: 400, height: 600)
        popover.contentViewController = NSHostingController(
            rootView: MenuBarView(viewModel: viewModel)
        )
    }

    // MARK: - Actions

    @objc private func togglePopover(_ sender: Any?) {
        guard let button = statusItem.button else { return }
        if popover.isShown {
            popover.performClose(sender)
        } else {
            // Ensure popover anchors to the correct screen: show relative to the status bar button.
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
        updateStatusItem()
    }

    // MARK: - Status Item UI

    private func updateStatusItem() {
        guard let button = statusItem.button else { return }

        // Icon: connected -> filled paw, disconnected -> outline paw
        let iconName = viewModel.isConnected ? "pawprint.fill" : "pawprint"
        button.image = NSImage(systemSymbolName: iconName, accessibilityDescription: "TabDog")
        button.imagePosition = .imageLeft

        // Title: show counts compactly
        let tabCount = viewModel.tabCount
        let windowCount = viewModel.windowCount

        if tabCount > 0 && windowCount > 0 {
            button.title = "\(tabCount)·\(windowCount)"
        } else if tabCount > 0 {
            button.title = "\(tabCount)"
        } else if windowCount > 0 {
            button.title = "\(windowCount)"
        } else {
            button.title = ""
        }
    }
    
    // MARK: - Hotkey Registration
    
    private func registerGlobalHotkey() {
        // Avoid double-registration
        unregisterGlobalHotkey()
        
        // Cmd + Shift + D
        let keyCode: UInt32 = UInt32(kVK_ANSI_D)
        let modifiers: UInt32 = UInt32(cmdKey | shiftKey)
        
        let status = RegisterEventHotKey(
            keyCode,
            modifiers,
            hotKeyId,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
        
        guard status == noErr else {
            print("[TabDog] Failed to register global hotkey, status=\(status)")
            return
        }
        
        // Install handler for hotkey press events
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let handler: EventHandlerUPP = { _, eventRef, userData in
            guard let userData else { return noErr }
            let delegate = Unmanaged<AppDelegate>.fromOpaque(userData).takeUnretainedValue()
            
            var hotKeyID = EventHotKeyID()
            let err = GetEventParameter(
                eventRef,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &hotKeyID
            )
            
            if err == noErr, hotKeyID.signature == delegate.hotKeyId.signature, hotKeyID.id == delegate.hotKeyId.id {
                DispatchQueue.main.async {
                    delegate.togglePopover(nil)
                }
            }
            
            return noErr
        }
        
        let handlerStatus = InstallEventHandler(
            GetApplicationEventTarget(),
            handler,
            1,
            &eventType,
            UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
            &hotKeyHandlerRef
        )
        
        if handlerStatus != noErr {
            print("[TabDog] Failed to install hotkey handler, status=\(handlerStatus)")
        }
    }
    
    private func unregisterGlobalHotkey() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
        if let hotKeyHandlerRef {
            RemoveEventHandler(hotKeyHandlerRef)
            self.hotKeyHandlerRef = nil
        }
    }
}

// MARK: - FourCharCode helper

private extension String {
    var fourCharCodeValue: FourCharCode {
        var result: FourCharCode = 0
        for scalar in unicodeScalars.prefix(4) {
            result = (result << 8) + FourCharCode(scalar.value)
        }
        return result
    }
}


