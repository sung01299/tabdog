//
//  TabViewModel.swift
//  TabDog
//
//  Main view model managing tab state and communication with Chrome extension
//

import Foundation
import SwiftUI
import AppKit

// MARK: - View Mode (Browser Tabs vs Windows)
enum ViewMode: String, CaseIterable {
    case browserTabs = "Browser"
    case windows = "Windows"
    
    var icon: String {
        switch self {
        case .browserTabs: return "globe"
        case .windows: return "macwindow"
        }
    }
}

// MARK: - Recently Quit Model

struct RecentlyQuitApp: Identifiable, Hashable {
    let appName: String
    let bundleIdentifier: String?
    let bundleURL: URL?
    let quitAt: Date
    
    var id: String {
        if let bundleIdentifier {
            return bundleIdentifier
        }
        return "\(appName)-\(quitAt.timeIntervalSince1970)"
    }
    
    var relativeTimeText: String {
        let seconds = Int(Date().timeIntervalSince(quitAt))
        if seconds < 60 { return "\(seconds)s ago" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        return "\(hours)h ago"
    }
}

// MARK: - Recently Closed Tabs (Browser Mode)

struct RecentlyClosedTab: Identifiable, Hashable {
    let title: String
    let url: String
    let domain: String
    let browser: String
    let closedAt: Date
    
    var id: String { "\(browser)-\(closedAt.timeIntervalSince1970)-\(url)" }
    
    var browserDisplayName: String {
        Tab.browserDisplayName(for: browser)
    }
    
    var relativeTimeText: String {
        let seconds = Int(Date().timeIntervalSince(closedAt))
        if seconds < 60 { return "\(seconds)s ago" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        return "\(hours)h ago"
    }
}

// MARK: - Sort Order
enum TabSortOrder: String, CaseIterable {
    case newestFirst = "Newest First"
    case oldestFirst = "Oldest First"
    
    var icon: String {
        switch self {
        case .newestFirst: return "arrow.down"
        case .oldestFirst: return "arrow.up"
        }
    }
}

@Observable
final class TabViewModel {
    
    // MARK: - Published State
    
    /// All tabs from all browsers
    var tabs: [Tab] = []
    
    /// Whether connected to any browser extension
    var isConnected: Bool = false
    
    /// List of currently connected browsers
    var connectedBrowsers: [String] = []
    
    /// Current error message (if any)
    var errorMessage: String?
    
    /// Search query for filtering tabs
    var searchQuery: String = ""
    
    /// Whether the host is registered
    var isHostRegistered: Bool = false
    
    /// Registered extension ID
    var extensionId: String = ""
    
    /// Host registration status by browser (for Settings UI)
    var hostRegistrationStatus: [HostRegistrationService.Browser: Bool] = [:]
    
    /// Whether to group tabs by domain
    var groupByDomain: Bool = true
    
    /// Expanded domain groups (default: all collapsed)
    var expandedDomains: Set<String> = []
    
    /// Sort order for tabs (newest or oldest first)
    var sortOrder: TabSortOrder = .newestFirst
    
    /// Current view mode (browser tabs or windows)
    var viewMode: ViewMode = .browserTabs
    
    // MARK: - Window State
    
    /// All macOS windows
    var windows: [WindowInfo] = []
    
    /// Windows grouped by app
    var appGroups: [AppWindowGroup] = []
    
    /// Expanded app groups
    var expandedApps: Set<String> = []
    
    // MARK: - Recently Quit (Window Mode)
    
    /// Recently quit apps (for quick relaunch)
    var recentlyQuitApps: [RecentlyQuitApp] = []
    
    /// How long to keep "recently quit" items
    private let recentlyQuitRetention: TimeInterval = 15 * 60

    // MARK: - Recently Closed (Browser Mode)

    /// Recently closed tabs (for quick reopen)
    var recentlyClosedTabs: [RecentlyClosedTab] = []

    /// How long to keep "recently closed" items
    private let recentlyClosedRetention: TimeInterval = 15 * 60
    
    // MARK: - Private Properties
    
    private let sharedData = SharedDataService.shared
    private let windowService = WindowService.shared
    private var pollingTimer: Timer?
    private var lastDataModification: Date?
    private var windowActivationAttemptId: Int = 0
    private var lastTabsById: [String: Tab] = [:]
    
    // MARK: - Computed Properties
    
    /// Total tab count
    var tabCount: Int {
        tabs.count
    }
    
    /// The currently active tab
    var activeTab: Tab? {
        tabs.first { $0.active }
    }
    
    /// Domain of the currently active tab
    var activeDomain: String? {
        activeTab?.domain
    }
    
    /// Tabs filtered by search query
    var filteredTabs: [Tab] {
        let filtered = tabSearchFilteredTabs
        
        // Sort: active first, then by time, then alphabetically if times are same
        return filtered.sorted { tab1, tab2 in
            // Active tab always first
            if tab1.active && !tab2.active { return true }
            if !tab1.active && tab2.active { return false }
            
            // Then sort by time (rounded to minute for stability)
            let time1 = tab1.openedAt ?? 0
            let time2 = tab2.openedAt ?? 0
            let minute1 = time1 / 60000  // Convert to minutes
            let minute2 = time2 / 60000
            
            if minute1 != minute2 {
                switch sortOrder {
                case .newestFirst:
                    return minute1 > minute2
                case .oldestFirst:
                    return minute1 < minute2
                }
            }
            
            // If times are same (within same minute), sort alphabetically by title
            return tab1.title.lowercased() < tab2.title.lowercased()
        }
    }
    
    /// Tabs grouped by domain (multi-tab groups only)
    var domainGroups: [DomainGroup] {
        let filtered = tabSearchFilteredTabs
        
        // Group tabs by root domain
        var groupDict: [String: [Tab]] = [:]
        for tab in filtered {
            let domain = tab.domain
            if groupDict[domain] == nil {
                groupDict[domain] = []
            }
            groupDict[domain]?.append(tab)
        }
        
        // Only create groups for domains with 2+ tabs
        let groups = groupDict
            .filter { $0.value.count >= 2 }
            .map { domain, tabs in
                // Sort tabs within group: active first, then by time, then alphabetically
                let sortedTabs = tabs.sorted { tab1, tab2 in
                    if tab1.active && !tab2.active { return true }
                    if !tab1.active && tab2.active { return false }
                    
                    let time1 = tab1.openedAt ?? 0
                    let time2 = tab2.openedAt ?? 0
                    let minute1 = time1 / 60000
                    let minute2 = time2 / 60000
                    
                    if minute1 != minute2 {
                        switch sortOrder {
                        case .newestFirst:
                            return minute1 > minute2
                        case .oldestFirst:
                            return minute1 < minute2
                        }
                    }
                    
                    return tab1.title.lowercased() < tab2.title.lowercased()
                }
                
                return DomainGroup(
                    domain: domain,
                    tabs: sortedTabs,
                    isExpanded: expandedDomains.contains(domain)
                )
            }
        
        // Sort groups: active domain first, then by time of newest/oldest tab, then alphabetically
        return groups.sorted { group1, group2 in
            let hasActive1 = group1.tabs.contains { $0.active }
            let hasActive2 = group2.tabs.contains { $0.active }
            
            // Active domain first
            if hasActive1 && !hasActive2 { return true }
            if !hasActive1 && hasActive2 { return false }
            
            // Then by time of the most relevant tab in group (rounded to minute)
            let time1 = getGroupSortTime(group1) / 60000
            let time2 = getGroupSortTime(group2) / 60000
            
            if time1 != time2 {
                switch sortOrder {
                case .newestFirst:
                    return time1 > time2
                case .oldestFirst:
                    return time1 < time2
                }
            }
            
            // If times are same, sort alphabetically by domain
            return group1.domain.lowercased() < group2.domain.lowercased()
        }
    }
    
    /// Get the time to use for sorting a group (newest or oldest tab in group)
    private func getGroupSortTime(_ group: DomainGroup) -> Int64 {
        let times = group.tabs.compactMap { $0.openedAt }
        switch sortOrder {
        case .newestFirst:
            return times.max() ?? 0
        case .oldestFirst:
            return times.min() ?? 0
        }
    }
    
    /// Single tabs (domains with only 1 tab) - shown without group wrapper
    var singleTabs: [Tab] {
        let filtered = tabSearchFilteredTabs
        
        // Count tabs per domain
        var domainCounts: [String: Int] = [:]
        for tab in filtered {
            domainCounts[tab.domain, default: 0] += 1
        }
        
        // Get tabs from domains with only 1 tab, sorted
        return filtered
            .filter { domainCounts[$0.domain] == 1 }
            .sorted { tab1, tab2 in
                // Active tab always first
                if tab1.active && !tab2.active { return true }
                if !tab1.active && tab2.active { return false }
                
                let time1 = tab1.openedAt ?? 0
                let time2 = tab2.openedAt ?? 0
                let minute1 = time1 / 60000
                let minute2 = time2 / 60000
                
                if minute1 != minute2 {
                    switch sortOrder {
                    case .newestFirst:
                        return minute1 > minute2
                    case .oldestFirst:
                        return minute1 < minute2
                    }
                }
                
                // If times are same, sort alphabetically by title
                return tab1.title.lowercased() < tab2.title.lowercased()
            }
    }

    // MARK: - Tab Search Parsing / Filtering (Browser Mode)

    /// Filter tabs using the search query, with a "browser prefix" shortcut:
    /// - If the first token matches exactly one known browser by prefix (even 1 char),
    ///   we interpret it as a browser filter (e.g. "b" -> Brave tabs).
    /// - Remaining tokens (if any) become the normal text search within that browser.
    private var tabSearchFilteredTabs: [Tab] {
        let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return tabs }

        let (browserFilter, textQuery) = parseTabSearchQuery(trimmed)

        if let browserFilter {
            let q = textQuery.lowercased()
            return tabs.filter { tab in
                let tabBrowser = (tab.browser ?? "unknown").lowercased()
                guard tabBrowser == browserFilter else { return false }
                if q.isEmpty { return true }
                return tab.title.lowercased().contains(q) ||
                    tab.url.lowercased().contains(q) ||
                    tab.domain.lowercased().contains(q)
            }
        }

        let q = trimmed.lowercased()
        return tabs.filter { tab in
            tab.title.lowercased().contains(q) ||
                tab.url.lowercased().contains(q) ||
                tab.domain.lowercased().contains(q)
        }
    }

    private func parseTabSearchQuery(_ trimmed: String) -> (browserFilter: String?, textQuery: String) {
        let tokens = trimmed
            .split(whereSeparator: { $0.isWhitespace })
            .map { String($0).lowercased() }

        guard let first = tokens.first else {
            return (nil, "")
        }

        if let browser = resolveBrowserPrefix(first) {
            let remaining = tokens.dropFirst().joined(separator: " ")
            return (browser, remaining)
        }

        return (nil, trimmed)
    }

    /// Returns a browser identifier (e.g. "brave") if `token` matches exactly one known browser by prefix.
    private func resolveBrowserPrefix(_ token: String) -> String? {
        let t = token.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !t.isEmpty else { return nil }

        let candidates = SharedDataService.knownBrowsers.filter { browser in
            let id = browser.lowercased()
            let name = Tab.browserDisplayName(for: id).lowercased()
            return id.hasPrefix(t) || name.hasPrefix(t)
        }

        guard candidates.count == 1 else { return nil }
        return candidates[0].lowercased()
    }
    
    /// Number of active (non-pinned regular) tabs
    var activeTabCount: Int {
        tabs.count
    }
    
    /// Unique domain count
    var domainCount: Int {
        Set(tabs.map { $0.domain }).count
    }
    
    /// Connected browser display names
    var connectedBrowserNames: String {
        if connectedBrowsers.isEmpty {
            return "Disconnected"
        }
        return connectedBrowsers.map { browser in
            switch browser.lowercased() {
            case "chrome": return "Chrome"
            case "brave": return "Brave"
            case "edge": return "Edge"
            case "opera": return "Opera"
            case "vivaldi": return "Vivaldi"
            default: return browser.capitalized
            }
        }.joined(separator: " + ")
    }
    
    /// Window count (visible only)
    var windowCount: Int {
        windows.filter { !$0.isHidden && !$0.isMinimized }.count
    }
    
    /// Hidden app count
    var hiddenAppCount: Int {
        windows.filter { $0.isHidden || $0.isMinimized }.count
    }
    
    /// Hidden apps
    var hiddenApps: [WindowInfo] {
        let hidden = windows.filter { $0.isHidden || $0.isMinimized }
        
        if searchQuery.isEmpty {
            return hidden.sorted { $0.ownerName.lowercased() < $1.ownerName.lowercased() }
        }
        
        let query = searchQuery.lowercased()
        return hidden.filter { $0.ownerName.lowercased().contains(query) }
            .sorted { $0.ownerName.lowercased() < $1.ownerName.lowercased() }
    }
    
    /// Recently quit apps (filtered + pruned; last 15 minutes)
    var filteredRecentlyQuitApps: [RecentlyQuitApp] {
        let now = Date()
        let kept = recentlyQuitApps.filter { now.timeIntervalSince($0.quitAt) <= recentlyQuitRetention }
        
        if searchQuery.isEmpty {
            return kept.sorted { $0.quitAt > $1.quitAt }
        }
        
        let q = searchQuery.lowercased()
        return kept
            .filter { $0.appName.lowercased().contains(q) }
            .sorted { $0.quitAt > $1.quitAt }
    }

    /// Recently closed tabs (filtered + pruned; last 15 minutes)
    var filteredRecentlyClosedTabs: [RecentlyClosedTab] {
        let now = Date()
        let kept = recentlyClosedTabs.filter { now.timeIntervalSince($0.closedAt) <= recentlyClosedRetention }

        let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return kept
        }

        let (browserFilter, textQuery) = parseTabSearchQuery(trimmed)
        let q = textQuery.lowercased()

        return kept.filter { item in
            if let browserFilter, item.browser.lowercased() != browserFilter {
                return false
            }
            if q.isEmpty { return true }
            return item.title.lowercased().contains(q) ||
                item.url.lowercased().contains(q) ||
                item.domain.lowercased().contains(q)
        }
    }
    
    /// App count (number of apps with visible windows)
    var appCount: Int {
        appGroups.count
    }
    
    /// Current mode's item count (for menu bar display)
    var currentModeCount: Int {
        switch viewMode {
        case .browserTabs:
            return tabCount
        case .windows:
            return windowCount
        }
    }
    
    /// Filtered windows based on search query
    var filteredWindows: [WindowInfo] {
        // Only visible windows should be counted in the main list; hidden apps are shown separately.
        let visible = windows.filter { !$0.isHidden && !$0.isMinimized }
        if searchQuery.isEmpty {
            return visible
        }
        let query = searchQuery.lowercased()
        return visible.filter {
            $0.displayTitle.lowercased().contains(query) ||
            $0.ownerName.lowercased().contains(query)
        }
    }
    
    /// Filtered app groups based on search query (only apps with 2+ windows)
    var filteredAppGroups: [AppWindowGroup] {
        let groups: [AppWindowGroup]
        
        if searchQuery.isEmpty {
            groups = appGroups
        } else {
            let query = searchQuery.lowercased()
            groups = appGroups.compactMap { group in
                let filteredWindows = group.windows.filter {
                    $0.displayTitle.lowercased().contains(query) ||
                    $0.ownerName.lowercased().contains(query)
                }
                if filteredWindows.isEmpty {
                    return nil
                }
                var newGroup = group
                newGroup.windows = filteredWindows
                return newGroup
            }
        }
        
        // Only return groups with 2+ windows
        return groups.filter { $0.windowCount >= 2 }
    }
    
    /// Single-window apps (shown without group header)
    var singleWindowApps: [WindowInfo] {
        let allWindows: [WindowInfo]
        
        if searchQuery.isEmpty {
            // Exclude hidden app pseudo-entries from the main list
            allWindows = windows.filter { !$0.isHidden && !$0.isMinimized }
        } else {
            let query = searchQuery.lowercased()
            allWindows = windows.filter { !$0.isHidden && !$0.isMinimized }.filter {
                $0.displayTitle.lowercased().contains(query) ||
                $0.ownerName.lowercased().contains(query)
            }
        }
        
        // Count windows per PID
        var pidCounts: [Int: Int] = [:]
        for window in allWindows {
            pidCounts[window.ownerPID, default: 0] += 1
        }
        
        // Return windows from apps with only 1 window
        return allWindows
            .filter { pidCounts[$0.ownerPID] == 1 }
            .sorted { $0.ownerName.lowercased() < $1.ownerName.lowercased() }
    }
    
    // MARK: - Initialization
    
    init() {
        checkHostRegistration()
        
        // For development/preview, load sample data
        #if DEBUG
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            loadSampleData()
        }
        #endif
    }
    
    deinit {
        stopPolling()
    }
    
    // MARK: - Polling for Shared Data
    
    /// Start polling for data
    func startPolling() {
        guard pollingTimer == nil else { return }
        
        // Poll immediately
        pollForUpdates()
        refreshWindows()
        
        // Then poll every 500ms
        pollingTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.pollForUpdates()
            
            // Refresh windows less frequently (every 2 seconds)
            // We use a simple counter approach
        }
        
        // Separate timer for windows (every 2 seconds)
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            if self?.viewMode == .windows {
                self?.refreshWindows()
            }
        }
        
        print("[TabDog UI] Started polling for updates")
    }
    
    /// Stop polling
    func stopPolling() {
        pollingTimer?.invalidate()
        pollingTimer = nil
    }
    
    /// Poll for updates from all browser data files
    private func pollForUpdates() {
        // Check connection status across all browsers
        let browsers = sharedData.getConnectedBrowsers()
        let connected = !browsers.isEmpty
        
        if connected != isConnected {
            isConnected = connected
        }
        if connectedBrowsers != browsers {
            connectedBrowsers = browsers
        }
        
        // Check if any data has been updated
        guard let modDate = sharedData.getLatestTabDataModificationDate() else {
            return
        }
        
        // Only read if any file has been modified
        if lastDataModification == nil || modDate > lastDataModification! {
            lastDataModification = modDate
            
            // Read and merge data from all connected browsers
            let mergedData = sharedData.readAllBrowserTabData()
            recordRecentlyClosedTabs(newTabs: mergedData.tabs, connectedBrowsers: browsers)
            tabs = mergedData.tabs
        }
    }

    private func recordRecentlyClosedTabs(newTabs: [Tab], connectedBrowsers: [String]) {
        // Don't treat disconnections as "closed tabs".
        let connected = connectedBrowsers.map { $0.lowercased() }
        guard !connected.isEmpty else {
            lastTabsById = Dictionary(uniqueKeysWithValues: newTabs.map { ($0.id, $0) })
            return
        }

        let newById = Dictionary(uniqueKeysWithValues: newTabs.map { ($0.id, $0) })

        if !lastTabsById.isEmpty {
            let now = Date()
            for (id, oldTab) in lastTabsById where newById[id] == nil {
                let browser = (oldTab.browser ?? "unknown").lowercased()
                // If the browser itself is disconnected, skip to avoid false positives.
                if browser != "unknown", !connected.contains(browser) {
                    continue
                }
                guard !oldTab.url.isEmpty else { continue }

                recentlyClosedTabs.insert(
                    RecentlyClosedTab(
                        title: oldTab.title,
                        url: oldTab.url,
                        domain: oldTab.domain,
                        browser: browser,
                        closedAt: now
                    ),
                    at: 0
                )
            }
        }

        // Prune (retention + cap)
        let cutoff = Date().addingTimeInterval(-recentlyClosedRetention)
        recentlyClosedTabs = recentlyClosedTabs
            .filter { $0.closedAt >= cutoff }
            .prefix(30)
            .map { $0 }

        lastTabsById = newById
    }
    
    // MARK: - Sort Order
    
    /// Toggle between sort orders
    func toggleSortOrder() {
        switch sortOrder {
        case .newestFirst:
            sortOrder = .oldestFirst
        case .oldestFirst:
            sortOrder = .newestFirst
        }
    }
    
    // MARK: - Host Registration
    
    /// Check if the Native Messaging Host is registered
    func checkHostRegistration() {
        hostRegistrationStatus = HostRegistrationService.registrationStatus()
        isHostRegistered = hostRegistrationStatus.values.contains(true)
        // In production we use a fixed extension id; keep showing the registered one if it exists.
        extensionId = HostRegistrationService.getRegisteredExtensionId() ?? HostRegistrationService.productionExtensionId
    }
    
    /// Register the Native Messaging Host
    func registerHost() {
        do {
            // Production: use fixed extension id and register for all supported browsers.
            try HostRegistrationService.registerProduction()
            checkHostRegistration()
            errorMessage = nil
        } catch {
            errorMessage = "Failed to register host: \(error.localizedDescription)"
        }
    }
    
    /// Unregister the Native Messaging Host
    func unregisterHost() {
        do {
            try HostRegistrationService.unregister()
            checkHostRegistration()
        } catch {
            errorMessage = "Failed to unregister host: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Domain Group Actions
    
    /// Toggle domain group expanded/collapsed state
    func toggleDomainExpanded(_ domain: String) {
        if expandedDomains.contains(domain) {
            expandedDomains.remove(domain)
        } else {
            expandedDomains.insert(domain)
        }
    }
    
    /// Expand all domain groups
    func expandAllDomains() {
        for group in domainGroups {
            expandedDomains.insert(group.domain)
        }
    }
    
    /// Collapse all domain groups
    func collapseAllDomains() {
        expandedDomains.removeAll()
    }
    
    /// Close all tabs in a domain
    func closeAllTabs(inDomain domain: String) {
        let domainTabs = tabs.filter { $0.domain == domain }
        let tabIds = domainTabs.map { $0.tabId }
        guard !tabIds.isEmpty else { return }
        
        // Get the browser for these tabs (assuming all tabs in domain are from same browser)
        let browser = domainTabs.first?.browser
        
        sharedData.writeCommand(.closeTabs(tabIds: tabIds, browser: browser))
        // Optimistically remove from local list
        tabs.removeAll { $0.domain == domain }
        // Remove from expanded if it was expanded
        expandedDomains.remove(domain)
    }
    
    // MARK: - Tab Actions
    
    /// Close a tab
    func closeTab(_ tab: Tab) {
        sharedData.writeCommand(.close(tabId: tab.tabId, browser: tab.browser))
        // Optimistically remove from local list
        tabs.removeAll { $0.id == tab.id }
    }
    
    /// Activate (focus) a tab
    func activateTab(_ tab: Tab) {
        sharedData.writeCommand(.activate(tabId: tab.tabId, windowId: tab.windowId, browser: tab.browser))
    }
    
    /// Request immediate update from extension
    func requestUpdate() {
        // Force re-read by clearing the last modification date
        lastDataModification = nil
        pollForUpdates()
        
        // Also refresh windows if in window mode
        if viewMode == .windows {
            refreshWindows()
        }
    }
    
    // MARK: - Window Actions
    
    /// Refresh window list including hidden apps
    func refreshWindows() {
        pruneRecentlyQuit()
        windows = windowService.getAllWindows()
        appGroups = windowService.getWindowsGroupedByApp()
    }
    
    /// Activate a window (or unhide if hidden)
    func activateWindow(_ window: WindowInfo) {
        // Single-click should behave like the user "trying twice".
        // macOS activation + AX focus/raise is timing-sensitive (menu bar popover focus, Spaces, etc.),
        // so we do a small follow-up attempt. We guard with an incrementing token so stale scheduled
        // attempts don't fire after the user clicks something else.
        windowActivationAttemptId += 1
        let attemptId = windowActivationAttemptId
        
        func performActivation() {
            if window.isHidden {
                windowService.unhideWindow(window)
            } else if window.isMinimized {
                windowService.unminimizeWindow(window)
            } else {
                windowService.activateWindow(window)
            }
        }
        
        performActivation()
        
        // Follow-up attempt after the app/window state has had time to settle.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) { [weak self] in
            guard let self, self.windowActivationAttemptId == attemptId else { return }
            performActivation()
        }
        // Refresh after a short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.refreshWindows()
        }
    }
    
    /// Hide a window (hides the entire app)
    func hideWindow(_ window: WindowInfo) {
        // User intent: same as clicking the yellow window button (minimize), not Cmd+H.
        windowService.minimizeWindow(window)
        
        // Optimistic UI update:
        // Minimized windows won't be returned by CGWindowListCopyWindowInfo(.optionOnScreenOnly),
        // so remove this window immediately for snappy UX.
        windows.removeAll { $0.id == window.id }
        // Also update grouped state
        appGroups = windowService.getWindowsGroupedByApp()
        
        // Add a minimized pseudo-entry immediately so it shows up under "Hidden Apps"
        if !windows.contains(where: { $0.id == window.id }) {
            windows.append(
                WindowInfo(
                    windowNumber: window.windowNumber,
                    ownerPID: window.ownerPID,
                    ownerName: window.ownerName,
                    windowName: window.windowName,
                    bounds: .zero,
                    layer: 0,
                    isOnScreen: false,
                    isHidden: false,
                    isMinimized: true
                )
            )
        }
        
        // Refresh after a short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.refreshWindows()
        }
    }
    
    /// Close a window
    func closeWindow(_ window: WindowInfo) {
        recordRecentlyQuit(window)
        windowService.closeWindow(window)
        // Optimistically remove all entries for that app (visible + hidden + minimized pseudo rows)
        windows.removeAll { $0.ownerPID == window.ownerPID }
        appGroups.removeAll { $0.pid == window.ownerPID }
        expandedApps = expandedApps.filter { !$0.hasPrefix("\(window.ownerPID)-") }
    }
    
    // MARK: - Recently Quit Helpers
    
    private func pruneRecentlyQuit() {
        let now = Date()
        recentlyQuitApps.removeAll { now.timeIntervalSince($0.quitAt) > recentlyQuitRetention }
    }
    
    private func recordRecentlyQuit(_ window: WindowInfo) {
        pruneRecentlyQuit()
        
        // Best-effort: fetch bundle id / URL from the running app before quitting.
        let runningApp = NSRunningApplication(processIdentifier: pid_t(window.ownerPID))
        let bundleId = runningApp?.bundleIdentifier
        let bundleURL = runningApp?.bundleURL
        
        let entry = RecentlyQuitApp(
            appName: window.ownerName,
            bundleIdentifier: bundleId,
            bundleURL: bundleURL,
            quitAt: Date()
        )
        
        // De-dup by bundle id when available, otherwise by name.
        if let bundleId {
            recentlyQuitApps.removeAll { $0.bundleIdentifier == bundleId }
        } else {
            recentlyQuitApps.removeAll { $0.bundleIdentifier == nil && $0.appName == entry.appName }
        }
        
        recentlyQuitApps.insert(entry, at: 0)
    }
    
    func relaunchRecentlyQuit(_ app: RecentlyQuitApp) {
        // Optimistic UX: once user requests relaunch, remove it from Recently Quit immediately.
        // If the app fails to launch, it can be quit again later and reappear.
        if let bundleId = app.bundleIdentifier {
            recentlyQuitApps.removeAll { $0.bundleIdentifier == bundleId }
        } else {
            recentlyQuitApps.removeAll { $0.bundleIdentifier == nil && $0.appName == app.appName }
        }
        
        // Prefer launching by bundle URL (most reliable)
        if let url = app.bundleURL {
            let config = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.openApplication(at: url, configuration: config)
            return
        }
        if let bundleId = app.bundleIdentifier {
            NSWorkspace.shared.launchApplication(withBundleIdentifier: bundleId, options: [], additionalEventParamDescriptor: nil, launchIdentifier: nil)
        }
    }

    // MARK: - Recently Closed Tabs (Browser Mode)

    func reopenRecentlyClosedTab(_ tab: RecentlyClosedTab) {
        // Optimistic UX: once user requests reopen, remove it immediately.
        recentlyClosedTabs.removeAll { $0.id == tab.id }

        sharedData.writeCommand(.openUrl(tab.url, browser: tab.browser))
    }
    
    /// Toggle app group expanded/collapsed state
    func toggleAppExpanded(_ appId: String) {
        if expandedApps.contains(appId) {
            expandedApps.remove(appId)
        } else {
            expandedApps.insert(appId)
        }
    }
    
    /// Expand all app groups
    func expandAllApps() {
        for group in appGroups {
            expandedApps.insert(group.id)
        }
    }
    
    /// Collapse all app groups
    func collapseAllApps() {
        expandedApps.removeAll()
    }
    
    // MARK: - Debug/Preview Helpers
    
    #if DEBUG
    func loadSampleData() {
        tabs = Tab.samples
        isConnected = true
        lastTabsById = Dictionary(uniqueKeysWithValues: tabs.map { ($0.id, $0) })
    }
    #endif
}
