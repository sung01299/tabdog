//
//  WindowInfo.swift
//  TabDoggy
//
//  Model representing a macOS window from CGWindowListCopyWindowInfo
//

import Foundation
import CoreGraphics
import AppKit

struct WindowInfo: Identifiable, Hashable {
    let windowNumber: Int
    let ownerPID: Int
    let ownerName: String
    let windowName: String?
    let bounds: CGRect
    let layer: Int
    let isOnScreen: Bool
    let isHidden: Bool  // App is hidden (Cmd+H)
    let isMinimized: Bool  // Window is minimized (yellow button)
    
    var id: Int { windowNumber }
    
    init(windowNumber: Int, ownerPID: Int, ownerName: String, windowName: String?, bounds: CGRect, layer: Int, isOnScreen: Bool, isHidden: Bool = false, isMinimized: Bool = false) {
        self.windowNumber = windowNumber
        self.ownerPID = ownerPID
        self.ownerName = ownerName
        self.windowName = windowName
        self.bounds = bounds
        self.layer = layer
        self.isOnScreen = isOnScreen
        self.isHidden = isHidden
        self.isMinimized = isMinimized
    }
    
    /// Application icon (cached via NSWorkspace)
    var appIcon: NSImage? {
        NSRunningApplication(processIdentifier: pid_t(ownerPID))?.icon
    }
    
    /// Display title - use window name if available, otherwise app name
    var displayTitle: String {
        if let name = windowName, !name.isEmpty {
            return name
        }
        return ownerName
    }
    
    /// Truncated title for display
    func truncatedTitle(maxLength: Int = 50) -> String {
        let title = displayTitle
        if title.count <= maxLength {
            return title
        }
        return String(title.prefix(maxLength - 1)) + "…"
    }
    
    /// Window size description
    var sizeDescription: String {
        "\(Int(bounds.width)) × \(Int(bounds.height))"
    }
}

// MARK: - App Group (for grouping windows by app)

struct AppWindowGroup: Identifiable {
    let appName: String
    let pid: Int
    var windows: [WindowInfo]
    var isExpanded: Bool = false
    
    var id: String { "\(pid)-\(appName)" }
    
    var windowCount: Int { windows.count }
    
    /// App icon
    var appIcon: NSImage? {
        NSRunningApplication(processIdentifier: pid_t(pid))?.icon
    }
}

// MARK: - Sample Data for Previews

extension WindowInfo {
    static let sample = WindowInfo(
        windowNumber: 1,
        ownerPID: 1234,
        ownerName: "Finder",
        windowName: "Documents",
        bounds: CGRect(x: 0, y: 0, width: 800, height: 600),
        layer: 0,
        isOnScreen: true
    )
    
    static let samples: [WindowInfo] = [
        WindowInfo(windowNumber: 1, ownerPID: 1234, ownerName: "Finder", windowName: "Documents", bounds: CGRect(x: 0, y: 0, width: 800, height: 600), layer: 0, isOnScreen: true),
        WindowInfo(windowNumber: 2, ownerPID: 1234, ownerName: "Finder", windowName: "Downloads", bounds: CGRect(x: 100, y: 100, width: 600, height: 400), layer: 0, isOnScreen: true),
        WindowInfo(windowNumber: 3, ownerPID: 2345, ownerName: "Code", windowName: "TabDoggy - Visual Studio Code", bounds: CGRect(x: 0, y: 0, width: 1200, height: 800), layer: 0, isOnScreen: true),
        WindowInfo(windowNumber: 4, ownerPID: 3456, ownerName: "Safari", windowName: "Apple - Start", bounds: CGRect(x: 200, y: 200, width: 1000, height: 700), layer: 0, isOnScreen: true),
        WindowInfo(windowNumber: 5, ownerPID: 4567, ownerName: "Slack", windowName: "Slack - General", bounds: CGRect(x: 300, y: 100, width: 900, height: 600), layer: 0, isOnScreen: true),
    ]
}

