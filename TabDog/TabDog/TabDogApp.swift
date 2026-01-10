//
//  TabDogApp.swift
//  TabDog
//
//  Created by Sung Huh on 8/1/2026.
//

import SwiftUI
import AppKit

@main
struct TabDogApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    
    init() {
        // Check if we're being launched by Chrome as a Native Messaging host
        // In that case, we run in bridge mode (no UI, just stdin/stdout)
        if Self.isLaunchedByChrome() {
            let bridge = BridgeMode()
            bridge.run()
            exit(0)
        }
    }
    
    var body: some Scene {
        // Settings window (opened via menu)
        Settings {
            // Note: SettingsLink from within the popover still works because this Scene exists.
            SettingsView(viewModel: appDelegate.viewModel)
        }
    }
    
    /// Check if the app was launched by Chrome for Native Messaging
    private static func isLaunchedByChrome() -> Bool {
        // Skip in Xcode environment
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] != nil ||
           ProcessInfo.processInfo.environment["__XCODE_BUILT_PRODUCTS_DIR_PATHS"] != nil {
            return false
        }
        
        // Check parent process first - this is the most reliable method
        let parentPID = getppid()
        if let parentName = getProcessName(pid: parentPID) {
            // If parent is launchd (PID 1) or common GUI launchers, it's a normal app launch
            let guiLaunchers = ["launchd", "Finder", "Dock", "Spotlight", "open"]
            if guiLaunchers.contains(where: { parentName.contains($0) }) || parentPID == 1 {
                return false
            }
            
            // All Chromium-based browsers
            let browserProcesses = [
                "Google Chrome", "Google Chrome Helper", "chrome",
                "Brave Browser", "Brave Browser Helper", "brave",
                "Microsoft Edge", "Microsoft Edge Helper", "edge",
                "Opera", "Opera Helper",
                "Vivaldi", "Vivaldi Helper"
            ]
            if browserProcesses.contains(where: { parentName.contains($0) }) {
                // Double-check: stdin should also be a pipe when launched by Chrome
                if isatty(STDIN_FILENO) == 0 {
                    return true
                }
            }
        }
        
        return false
    }
    
    /// Get the name of a process by PID
    private static func getProcessName(pid: pid_t) -> String? {
        let name = UnsafeMutablePointer<CChar>.allocate(capacity: 1024)
        defer { name.deallocate() }
        
        proc_name(pid, name, 1024)
        return String(cString: name)
    }
}

// Import for proc_name
import Darwin
