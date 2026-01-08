//
//  WindowService.swift
//  TabDoggy
//
//  Service for getting and controlling macOS windows using Core Graphics and Accessibility APIs
//

import Foundation
import CoreGraphics
import AppKit

/// Service for managing macOS windows
class WindowService {
    
    // MARK: - Singleton
    
    static let shared = WindowService()
    
    private init() {}
    
    // MARK: - Window List
    
    /// Apps to exclude from the window list
    private let excludedApps: Set<String> = [
        "Dock",
        "Window Server",
        "WindowServer",
        "SystemUIServer",
        "Spotlight",
        "Control Center",
        "Notification Center",
        "AXVisualSupportAgent",
        "universalaccessd",
        "TabDoggy"  // Exclude ourselves
    ]
    
    /// Get list of all visible windows on screen
    func getWindowList() -> [WindowInfo] {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        
        guard let windowInfoList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
            return []
        }
        
        var windows: [WindowInfo] = []
        
        for windowInfo in windowInfoList {
            // Extract window info
            guard let windowNumber = windowInfo[kCGWindowNumber as String] as? Int,
                  let ownerPID = windowInfo[kCGWindowOwnerPID as String] as? Int,
                  let ownerName = windowInfo[kCGWindowOwnerName as String] as? String,
                  let layer = windowInfo[kCGWindowLayer as String] as? Int else {
                continue
            }
            
            // Skip excluded apps
            if excludedApps.contains(ownerName) {
                continue
            }
            
            // Skip windows not in the normal layer (layer 0 is normal windows)
            if layer != 0 {
                continue
            }
            
            // Get bounds
            var bounds = CGRect.zero
            if let boundsDict = windowInfo[kCGWindowBounds as String] as? [String: Any] {
                if let x = boundsDict["X"] as? CGFloat,
                   let y = boundsDict["Y"] as? CGFloat,
                   let width = boundsDict["Width"] as? CGFloat,
                   let height = boundsDict["Height"] as? CGFloat {
                    bounds = CGRect(x: x, y: y, width: width, height: height)
                }
            }
            
            // Skip very small windows (likely utility windows)
            if bounds.width < 100 || bounds.height < 100 {
                continue
            }
            
            let windowName = windowInfo[kCGWindowName as String] as? String
            let isOnScreen = windowInfo[kCGWindowIsOnscreen as String] as? Bool ?? true
            
            let info = WindowInfo(
                windowNumber: windowNumber,
                ownerPID: ownerPID,
                ownerName: ownerName,
                windowName: windowName,
                bounds: bounds,
                layer: layer,
                isOnScreen: isOnScreen,
                isHidden: false
            )
            
            windows.append(info)
        }
        
        return windows
    }
    
    /// Get list of hidden apps (apps that have been hidden with Cmd+H)
    func getHiddenApps() -> [WindowInfo] {
        var hiddenWindows: [WindowInfo] = []
        
        // Get all running apps
        let runningApps = NSWorkspace.shared.runningApplications
        
        for app in runningApps {
            // Skip apps without windows or that are not regular apps
            guard app.activationPolicy == .regular,
                  app.isHidden,
                  let appName = app.localizedName else {
                continue
            }
            
            // Skip excluded apps
            if excludedApps.contains(appName) {
                continue
            }
            
            // Create a pseudo-window entry for hidden apps
            let window = WindowInfo(
                windowNumber: Int(app.processIdentifier) * -1,  // Negative to distinguish from real windows
                ownerPID: Int(app.processIdentifier),
                ownerName: appName,
                windowName: nil,
                bounds: .zero,
                layer: 0,
                isOnScreen: false,
                isHidden: true
            )
            
            hiddenWindows.append(window)
        }
        
        return hiddenWindows
    }
    
    /// Get all windows including hidden apps
    func getAllWindows() -> [WindowInfo] {
        var all = getWindowList()
        all.append(contentsOf: getHiddenApps())
        all.append(contentsOf: getMinimizedWindows())
        return all
    }
    
    /// Get windows grouped by application
    func getWindowsGroupedByApp() -> [AppWindowGroup] {
        let windows = getWindowList()
        
        // Group by PID
        var groupDict: [Int: [WindowInfo]] = [:]
        for window in windows {
            if groupDict[window.ownerPID] == nil {
                groupDict[window.ownerPID] = []
            }
            groupDict[window.ownerPID]?.append(window)
        }
        
        // Create groups
        return groupDict.compactMap { pid, windows in
            guard let firstWindow = windows.first else { return nil }
            return AppWindowGroup(
                appName: firstWindow.ownerName,
                pid: pid,
                windows: windows
            )
        }.sorted { $0.appName.lowercased() < $1.appName.lowercased() }
    }
    
    // MARK: - Window Control
    
    /// Activate (bring to front) a window
    func activateWindow(_ window: WindowInfo) {
        guard let app = NSRunningApplication(processIdentifier: pid_t(window.ownerPID)) else {
            print("[WindowService] Could not find app with PID \(window.ownerPID)")
            return
        }
        
        // If Accessibility permission isn't granted, AX focus/raise will be unreliable or no-op.
        if !isAccessibilityTrusted() {
            print("[WindowService] Accessibility permission not granted. Window focusing may fail. Enable in System Settings → Privacy & Security → Accessibility.")
        }
        
        // Hidden app: unhide first (Cmd+H state), then proceed with activation/focus.
        if window.isHidden {
            app.unhide()
        }
        
        // We do a small sequence of attempts because macOS activation is timing-sensitive:
        // - Activate app (brings it to front)
        // - Focus + raise the specific window (sets main/focused window so it becomes truly "active")
        // Retrying improves reliability across apps and Spaces.
        let delays: [TimeInterval] = [0.0, 0.05, 0.15]
        for delay in delays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self else { return }
                _ = app.activate(options: [.activateIgnoringOtherApps, .activateAllWindows])
                self.focusAndRaiseWindowViaAccessibility(window)
            }
        }
    }
    
    /// Hide an app (all its windows go to background)
    func hideWindow(_ window: WindowInfo) {
        if let app = NSRunningApplication(processIdentifier: pid_t(window.ownerPID)) {
            app.hide()
        }
    }

    /// Minimize a specific window (equivalent to clicking the yellow window button).
    /// This is different from hiding the app (Cmd+H).
    func minimizeWindow(_ window: WindowInfo) {
        let appElement = AXUIElementCreateApplication(pid_t(window.ownerPID))
        
        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard result == .success, let axWindows = windowsRef as? [AXUIElement], !axWindows.isEmpty else {
            return
        }
        
        // Find the best matching window (prefer windowNumber match)
        let target = findBestMatchingAXWindow(for: window, in: axWindows) ?? axWindows.first!
        
        // Prefer setting AXMinimized directly; if not supported, fall back to pressing the minimize button.
        let minimizedSetResult = AXUIElementSetAttributeValue(target, kAXMinimizedAttribute as CFString, kCFBooleanTrue)
        if minimizedSetResult == .success {
            return
        }
        
        var minimizeButtonRef: CFTypeRef?
        let buttonResult = AXUIElementCopyAttributeValue(target, kAXMinimizeButtonAttribute as CFString, &minimizeButtonRef)
        if buttonResult == .success, let minimizeButton = minimizeButtonRef as! AXUIElement? {
            _ = AXUIElementPerformAction(minimizeButton, kAXPressAction as CFString)
        }
    }

    /// Unminimize (restore) a specific window and bring it to front.
    func unminimizeWindow(_ window: WindowInfo) {
        guard let app = NSRunningApplication(processIdentifier: pid_t(window.ownerPID)) else { return }
        
        let appElement = AXUIElementCreateApplication(pid_t(window.ownerPID))
        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard result == .success, let axWindows = windowsRef as? [AXUIElement], !axWindows.isEmpty else {
            return
        }
        
        let target = findBestMatchingAXWindow(for: window, in: axWindows) ?? axWindows.first!
        _ = AXUIElementSetAttributeValue(target, kAXMinimizedAttribute as CFString, kCFBooleanFalse)
        
        // After restoring, activate + focus/raise to make it the true active window.
        let delays: [TimeInterval] = [0.0, 0.05, 0.15]
        for delay in delays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self else { return }
                _ = app.activate(options: [.activateIgnoringOtherApps, .activateAllWindows])
                self.focusAndRaiseWindowViaAccessibility(window)
            }
        }
    }
    
    /// Unhide/Show an app (bring it back from hidden state)
    func unhideWindow(_ window: WindowInfo) {
        if let app = NSRunningApplication(processIdentifier: pid_t(window.ownerPID)) {
            app.unhide()
            app.activate(options: [.activateIgnoringOtherApps, .activateAllWindows])
        }
    }
    
    /// Close a specific window using Accessibility API
    func closeWindow(_ window: WindowInfo) {
        let appElement = AXUIElementCreateApplication(pid_t(window.ownerPID))
        
        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        
        guard result == .success, let axWindows = windowsRef as? [AXUIElement] else {
            print("[WindowService] Could not get windows for PID \(window.ownerPID)")
            return
        }
        
        let targetTitle = window.windowName ?? ""
        
        // Find matching window
        for axWindow in axWindows {
            var titleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(axWindow, kAXTitleAttribute as CFString, &titleRef)
            let title = titleRef as? String ?? ""
            
            // Match by title, or close first window if no target title
            if title == targetTitle || targetTitle.isEmpty || axWindows.count == 1 {
                // Get close button and press it
                var closeButtonRef: CFTypeRef?
                let closeResult = AXUIElementCopyAttributeValue(axWindow, kAXCloseButtonAttribute as CFString, &closeButtonRef)
                
                if closeResult == .success, let closeButton = closeButtonRef as! AXUIElement? {
                    let pressResult = AXUIElementPerformAction(closeButton, kAXPressAction as CFString)
                    if pressResult == .success {
                        print("[WindowService] Closed window: \(title)")
                    } else {
                        print("[WindowService] Failed to press close button, error: \(pressResult.rawValue)")
                    }
                    return
                } else {
                    print("[WindowService] Could not get close button for window: \(title)")
                }
            }
        }
        
        print("[WindowService] No matching window found to close")
    }
    
    // MARK: - Accessibility Helpers
    
    /// Best-effort check for Accessibility trust (permission).
    private func isAccessibilityTrusted() -> Bool {
        // We don't prompt here; UI should guide the user if needed.
        AXIsProcessTrusted()
    }
    
    /// AX attribute for window number (not provided as a Swift constant).
    private let axWindowNumberAttribute: CFString = "AXWindowNumber" as CFString
    
    /// Focus + raise the specific window using Accessibility API.
    /// Uses windowNumber matching first (more reliable), then falls back to title matching.
    private func focusAndRaiseWindowViaAccessibility(_ window: WindowInfo) {
        let appElement = AXUIElementCreateApplication(pid_t(window.ownerPID))
        
        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard result == .success, let axWindows = windowsRef as? [AXUIElement], !axWindows.isEmpty else {
            // If this fails, focus cannot be guaranteed.
            return
        }
        
        let targetAXWindow = findBestMatchingAXWindow(for: window, in: axWindows) ?? axWindows.first!
        
        // Prefer Cmd+Tab-like behavior: make the app frontmost + raise/focus its window.
        // Moving windows across displays can be disorienting and may behave inconsistently
        // depending on coordinate spaces, so we only do it as a last resort when the window
        // appears to be completely off-screen.
        setAXAppFrontmost(appElement)
        moveAXWindowToUserActiveScreenIfOffscreen(targetAXWindow)

        // Set focused/main first; some apps require this to truly become "active".
        _ = AXUIElementSetAttributeValue(appElement, kAXMainWindowAttribute as CFString, targetAXWindow)
        _ = AXUIElementSetAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, targetAXWindow)
        
        // Then raise it to front.
        _ = AXUIElementPerformAction(targetAXWindow, kAXRaiseAction as CFString)
    }
    
    private func findBestMatchingAXWindow(for window: WindowInfo, in axWindows: [AXUIElement]) -> AXUIElement? {
        // 1) Try matching by window number (most reliable when available)
        if !window.isHidden && window.windowNumber > 0 {
            for axWindow in axWindows {
                var numRef: CFTypeRef?
                let r = AXUIElementCopyAttributeValue(axWindow, axWindowNumberAttribute, &numRef)
                if r == .success, let axNum = numRef as? Int, axNum == window.windowNumber {
                    return axWindow
                }
            }
        }
        
        // 2) Fallback: match by exact title (can be flaky because CGWindowName != AXTitle)
        let targetTitle = window.windowName ?? ""
        if !targetTitle.isEmpty {
            for axWindow in axWindows {
                var titleRef: CFTypeRef?
                _ = AXUIElementCopyAttributeValue(axWindow, kAXTitleAttribute as CFString, &titleRef)
                let title = (titleRef as? String) ?? ""
                if title == targetTitle {
                    return axWindow
                }
            }
            // 3) Fuzzy contains match as a last resort
            for axWindow in axWindows {
                var titleRef: CFTypeRef?
                _ = AXUIElementCopyAttributeValue(axWindow, kAXTitleAttribute as CFString, &titleRef)
                let title = (titleRef as? String) ?? ""
                if title.localizedCaseInsensitiveContains(targetTitle) || targetTitle.localizedCaseInsensitiveContains(title) {
                    return axWindow
                }
            }
        }
        
        return nil
    }

    // MARK: - Cross-display visibility helper
    
    private func userActiveScreen() -> NSScreen? {
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first(where: { $0.frame.contains(mouse) }) ?? NSScreen.main
    }
    
    private func screen(containing point: CGPoint) -> NSScreen? {
        NSScreen.screens.first(where: { $0.frame.contains(point) })
    }
    
    private func readAXPosition(_ axWindow: AXUIElement) -> CGPoint? {
        var posRef: CFTypeRef?
        let r = AXUIElementCopyAttributeValue(axWindow, kAXPositionAttribute as CFString, &posRef)
        guard r == .success, let posRef else { return nil }
        let axVal = posRef as! AXValue
        var p = CGPoint.zero
        guard AXValueGetType(axVal) == .cgPoint, AXValueGetValue(axVal, .cgPoint, &p) else { return nil }
        return p
    }
    
    private func readAXSize(_ axWindow: AXUIElement) -> CGSize? {
        var sizeRef: CFTypeRef?
        let r = AXUIElementCopyAttributeValue(axWindow, kAXSizeAttribute as CFString, &sizeRef)
        guard r == .success, let sizeRef else { return nil }
        let axVal = sizeRef as! AXValue
        var s = CGSize.zero
        guard AXValueGetType(axVal) == .cgSize, AXValueGetValue(axVal, .cgSize, &s) else { return nil }
        return s
    }
    
    private func setAXPosition(_ axWindow: AXUIElement, _ point: CGPoint) {
        var p = point
        if let axVal = AXValueCreate(.cgPoint, &p) {
            _ = AXUIElementSetAttributeValue(axWindow, kAXPositionAttribute as CFString, axVal)
        }
    }
    
    private let axFrontmostAttribute: CFString = "AXFrontmost" as CFString
    
    private func setAXAppFrontmost(_ appElement: AXUIElement) {
        _ = AXUIElementSetAttributeValue(appElement, axFrontmostAttribute, kCFBooleanTrue)
    }
    
    private func windowRectInAXCoordinates(_ axWindow: AXUIElement) -> CGRect? {
        guard let pos = readAXPosition(axWindow),
              let size = readAXSize(axWindow),
              size.width > 1, size.height > 1 else { return nil }
        return CGRect(origin: pos, size: size)
    }
    
    private func isRectVisibleOnAnyScreen(_ rect: CGRect) -> Bool {
        // We only need a heuristic: does it intersect any screen frame at all?
        for screen in NSScreen.screens {
            if rect.intersects(screen.frame) {
                return true
            }
        }
        return false
    }
    
    private func moveAXWindowToUserActiveScreenIfOffscreen(_ axWindow: AXUIElement) {
        guard let targetScreen = userActiveScreen() else { return }
        let targetFrame = targetScreen.visibleFrame
        
        guard let rect = windowRectInAXCoordinates(axWindow) else { return }
        // Only move when it's totally off-screen. If it's on another display but "behind",
        // moving it is often worse UX than just raising/focusing.
        guard !isRectVisibleOnAnyScreen(rect) else { return }
        
        let pos = rect.origin
        let size = rect.size
        
        let center = CGPoint(x: pos.x + size.width / 2, y: pos.y + size.height / 2)
        guard let currentScreen = screen(containing: center) else { return }
        
        // Already on user's active screen → do nothing.
        if currentScreen == targetScreen { return }
        
        let currentFrame = currentScreen.visibleFrame
        let dx = targetFrame.midX - currentFrame.midX
        let dy = targetFrame.midY - currentFrame.midY
        
        var newPos = CGPoint(x: pos.x + dx, y: pos.y + dy)
        
        // Clamp into target visible frame so it doesn't land off-screen.
        newPos.x = min(max(newPos.x, targetFrame.minX + 8), targetFrame.maxX - size.width - 8)
        newPos.y = min(max(newPos.y, targetFrame.minY + 8), targetFrame.maxY - size.height - 8)
        
        setAXPosition(axWindow, newPos)
    }

    /// Get minimized windows via Accessibility (these do NOT show up in CGWindowListCopyWindowInfo(.optionOnScreenOnly)).
    func getMinimizedWindows() -> [WindowInfo] {
        // Without Accessibility permission, we can't reliably detect minimized windows.
        guard isAccessibilityTrusted() else { return [] }
        
        var minimized: [WindowInfo] = []
        let runningApps = NSWorkspace.shared.runningApplications
        
        for app in runningApps {
            guard app.activationPolicy == .regular,
                  let appName = app.localizedName else { continue }
            
            if excludedApps.contains(appName) { continue }
            
            // If the whole app is hidden (Cmd+H), we represent it via getHiddenApps() only.
            if app.isHidden { continue }
            
            let pid = Int(app.processIdentifier)
            let appElement = AXUIElementCreateApplication(pid_t(pid))
            
            var windowsRef: CFTypeRef?
            let r = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
            guard r == .success, let axWindows = windowsRef as? [AXUIElement], !axWindows.isEmpty else {
                continue
            }
            
            for (idx, axWindow) in axWindows.enumerated() {
                var minimizedRef: CFTypeRef?
                let mr = AXUIElementCopyAttributeValue(axWindow, kAXMinimizedAttribute as CFString, &minimizedRef)
                let isMin = (mr == .success) && ((minimizedRef as? Bool) == true)
                guard isMin else { continue }
                
                // Title (best-effort)
                var titleRef: CFTypeRef?
                _ = AXUIElementCopyAttributeValue(axWindow, kAXTitleAttribute as CFString, &titleRef)
                let title = (titleRef as? String)
                
                // Window number (best-effort). If missing, create a stable negative id.
                var numRef: CFTypeRef?
                let nr = AXUIElementCopyAttributeValue(axWindow, axWindowNumberAttribute, &numRef)
                let windowNumber = (nr == .success ? (numRef as? Int) : nil) ?? (-(pid * 1000 + idx + 1))
                
                minimized.append(
                    WindowInfo(
                        windowNumber: windowNumber,
                        ownerPID: pid,
                        ownerName: appName,
                        windowName: title,
                        bounds: .zero,
                        layer: 0,
                        isOnScreen: false,
                        isHidden: false,
                        isMinimized: true
                    )
                )
            }
        }
        
        return minimized
    }
}

