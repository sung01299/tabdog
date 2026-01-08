//
//  TabViewModel.swift
//  TabDoggy
//
//  Main view model managing tab state and communication with Chrome extension
//

import Foundation
import SwiftUI

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
    
    // MARK: - Private Properties
    
    private let sharedData = SharedDataService.shared
    private let windowService = WindowService.shared
    private var pollingTimer: Timer?
    private var lastDataModification: Date?
    private var windowActivationAttemptId: Int = 0
    
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
        let filtered: [Tab]
        if searchQuery.isEmpty {
            filtered = tabs
        } else {
            let query = searchQuery.lowercased()
            filtered = tabs.filter { tab in
                tab.title.lowercased().contains(query) ||
                tab.url.lowercased().contains(query) ||
                tab.domain.lowercased().contains(query)
            }
        }
        
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
        let filtered = searchQuery.isEmpty ? tabs : tabs.filter { tab in
            let query = searchQuery.lowercased()
            return tab.title.lowercased().contains(query) ||
                   tab.url.lowercased().contains(query) ||
                   tab.domain.lowercased().contains(query)
        }
        
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
        let filtered = searchQuery.isEmpty ? tabs : tabs.filter { tab in
            let query = searchQuery.lowercased()
            return tab.title.lowercased().contains(query) ||
                   tab.url.lowercased().contains(query) ||
                   tab.domain.lowercased().contains(query)
        }
        
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
        
        print("[TabDoggy UI] Started polling for updates")
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
            tabs = mergedData.tabs
        }
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
        isHostRegistered = HostRegistrationService.isRegistered()
        if let registeredId = HostRegistrationService.getRegisteredExtensionId() {
            extensionId = registeredId
        }
    }
    
    /// Register the Native Messaging Host
    func registerHost() {
        guard !extensionId.isEmpty else {
            errorMessage = "Please enter the Chrome extension ID"
            return
        }
        
        do {
            try HostRegistrationService.register(extensionId: extensionId)
            isHostRegistered = true
            errorMessage = nil
        } catch {
            errorMessage = "Failed to register host: \(error.localizedDescription)"
        }
    }
    
    /// Unregister the Native Messaging Host
    func unregisterHost() {
        do {
            try HostRegistrationService.unregister()
            isHostRegistered = false
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
        windowService.closeWindow(window)
        // Optimistically remove from list
        windows.removeAll { $0.id == window.id }
        appGroups = windowService.getWindowsGroupedByApp()
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
    }
    #endif
}
