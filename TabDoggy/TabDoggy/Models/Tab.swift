//
//  Tab.swift
//  TabDoggy
//
//  Tab data model representing a Chrome browser tab
//

import Foundation

struct Tab: Identifiable, Codable, Hashable {
    let tabId: Int
    let windowId: Int
    let title: String
    let url: String
    let favIconUrl: String?
    let active: Bool
    let pinned: Bool
    let openedAt: Int64?  // Unix timestamp in milliseconds
    var browser: String?  // Browser type: "chrome", "brave", etc.
    
    var id: String { "\(browser ?? "unknown")-\(tabId)" }  // Unique across browsers
    
    /// Browser display name
    var browserDisplayName: String {
        switch browser?.lowercased() {
        case "chrome": return "Chrome"
        case "brave": return "Brave"
        case "edge": return "Edge"
        case "opera": return "Opera"
        case "vivaldi": return "Vivaldi"
        default: return browser?.capitalized ?? "Browser"
        }
    }
    
    /// Full domain extracted from URL (e.g., "music.youtube.com")
    var fullDomain: String {
        guard let urlObj = URL(string: url),
              let host = urlObj.host else {
            return url.isEmpty ? "Other" : url
        }
        // Remove www. prefix if present
        if host.hasPrefix("www.") {
            return String(host.dropFirst(4))
        }
        return host
    }
    
    /// Root domain for grouping (e.g., "youtube.com" from "music.youtube.com")
    var domain: String {
        let full = fullDomain
        let components = full.split(separator: ".")
        
        // Handle special cases and short domains
        guard components.count >= 2 else {
            return full
        }
        
        // Common two-part TLDs (co.uk, com.au, etc.)
        let twoPartTLDs = ["co.uk", "com.au", "co.jp", "co.kr", "com.br", "co.nz"]
        let lastTwo = components.suffix(2).joined(separator: ".")
        
        if twoPartTLDs.contains(lastTwo) && components.count >= 3 {
            // e.g., "bbc.co.uk" -> "bbc.co.uk"
            return components.suffix(3).joined(separator: ".")
        }
        
        // Standard case: take last two parts
        // e.g., "music.youtube.com" -> "youtube.com"
        return components.suffix(2).joined(separator: ".")
    }
    
    /// How long the tab has been open
    var openDuration: TimeInterval? {
        guard let openedAt = openedAt else { return nil }
        let openDate = Date(timeIntervalSince1970: Double(openedAt) / 1000.0)
        return Date().timeIntervalSince(openDate)
    }
    
    /// Formatted duration string (e.g., "2h 30m", "5m", "< 1m")
    var formattedDuration: String {
        guard let duration = openDuration else { return "" }
        
        let minutes = Int(duration / 60)
        let hours = minutes / 60
        let days = hours / 24
        
        if days > 0 {
            return "\(days)d \(hours % 24)h"
        } else if hours > 0 {
            return "\(hours)h \(minutes % 60)m"
        } else if minutes > 0 {
            return "\(minutes)m"
        } else {
            return "< 1m"
        }
    }
    
    /// Truncated title for display
    func truncatedTitle(maxLength: Int = 40) -> String {
        if title.count <= maxLength {
            return title
        }
        return String(title.prefix(maxLength - 1)) + "…"
    }
}

// MARK: - Domain Group
struct DomainGroup: Identifiable {
    let domain: String
    var tabs: [Tab]
    var isExpanded: Bool = false  // Default: collapsed
    
    var id: String { domain }
    
    var tabCount: Int { tabs.count }
    
    /// Get all tab IDs in this group
    var tabIds: [Int] {
        tabs.map { $0.tabId }
    }
    
    /// Whether this is a single-tab group (should be displayed without group header)
    var isSingleTab: Bool {
        tabs.count == 1
    }
}

// MARK: - Sample Data for Previews
extension Tab {
    static let sample = Tab(
        tabId: 1,
        windowId: 1,
        title: "GitHub - user/tab-doggy: Monitor Chrome tabs from macOS menu bar",
        url: "https://github.com/user/tab-doggy",
        favIconUrl: "https://github.com/favicon.ico",
        active: true,
        pinned: false,
        openedAt: Int64(Date().addingTimeInterval(-3600).timeIntervalSince1970 * 1000)  // 1 hour ago
    )
    
    static let samples: [Tab] = [
        Tab(tabId: 1, windowId: 1, title: "GitHub - TabDoggy", url: "https://github.com/user/tab-doggy", favIconUrl: nil, active: true, pinned: false, openedAt: Int64(Date().addingTimeInterval(-7200).timeIntervalSince1970 * 1000)),
        Tab(tabId: 2, windowId: 1, title: "GitHub - Swift", url: "https://github.com/apple/swift", favIconUrl: nil, active: false, pinned: false, openedAt: Int64(Date().addingTimeInterval(-3600).timeIntervalSince1970 * 1000)),
        Tab(tabId: 3, windowId: 1, title: "Gmail - Inbox (3)", url: "https://mail.google.com", favIconUrl: nil, active: false, pinned: true, openedAt: Int64(Date().addingTimeInterval(-86400).timeIntervalSince1970 * 1000)),
        Tab(tabId: 4, windowId: 1, title: "Google Calendar", url: "https://calendar.google.com", favIconUrl: nil, active: false, pinned: false, openedAt: Int64(Date().addingTimeInterval(-1800).timeIntervalSince1970 * 1000)),
        Tab(tabId: 5, windowId: 1, title: "YouTube Music", url: "https://music.youtube.com", favIconUrl: nil, active: false, pinned: false, openedAt: Int64(Date().addingTimeInterval(-300).timeIntervalSince1970 * 1000)),
        Tab(tabId: 6, windowId: 2, title: "YouTube - Swift Tutorial", url: "https://youtube.com/watch?v=abc123", favIconUrl: nil, active: false, pinned: false, openedAt: Int64(Date().addingTimeInterval(-600).timeIntervalSince1970 * 1000)),
        Tab(tabId: 7, windowId: 2, title: "Apple Developer Documentation", url: "https://developer.apple.com/documentation", favIconUrl: nil, active: false, pinned: false, openedAt: Int64(Date().addingTimeInterval(-172800).timeIntervalSince1970 * 1000)),
    ]
}
