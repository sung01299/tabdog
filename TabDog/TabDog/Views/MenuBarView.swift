//
//  MenuBarView.swift
//  TabDog
//
//  Main menu bar content view
//

import SwiftUI
import AppKit

struct MenuBarView: View {
    @Bindable var viewModel: TabViewModel
    @FocusState private var isSearchFocused: Bool
    @State private var keyDownMonitor: Any?
    @State private var keyboardSelection: KeyboardSelection?

    private enum KeyboardSelection: Hashable {
        case domainGroup(String) // domain
        case tab(String) // Tab.id
        case recentlyClosedTab(String) // RecentlyClosedTab.id
        case appGroup(String) // AppWindowGroup.id
        case window(Int) // WindowInfo.id
        case hiddenApp(Int) // WindowInfo.id (hidden app pseudo entry)
        case recentlyQuit(String) // RecentlyQuitApp.id
        
        /// Returns a stable scroll ID for ScrollViewReader
        var scrollId: String {
            switch self {
            case .domainGroup(let domain): return "domain-\(domain)"
            case .tab(let id): return "tab-\(id)"
            case .recentlyClosedTab(let id): return "recentlyClosed-\(id)"
            case .appGroup(let id): return "appGroup-\(id)"
            case .window(let id): return "window-\(id)"
            case .hiddenApp(let id): return "hiddenApp-\(id)"
            case .recentlyQuit(let id): return "recentlyQuit-\(id)"
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Mode toggle (Browser Tabs / Windows)
            modeToggleView
            
            Divider()
            
            // Header with status info
            headerView
            
            Divider()
            
            // Content based on mode
            switch viewModel.viewMode {
            case .browserTabs:
                browserTabsContent
            case .windows:
                windowsContent
            }
            
            Divider()
            
            // Footer with actions
            footerView
        }
        .frame(width: 400)
        .onAppear {
            // Auto-focus search bar when menu opens
            focusSearchBar()
            installKeyMonitorIfNeeded()
            keyboardSelection = nil
        }
        .onDisappear {
            removeKeyMonitorIfNeeded()
        }
        .onChange(of: viewModel.viewMode) { _, _ in
            // Reset keyboard selection when changing modes
            keyboardSelection = nil
            focusSearchBar()
        }
        .onChange(of: isSearchFocused) { _, newValue in
            if newValue {
                keyboardSelection = nil
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func focusSearchBar() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            isSearchFocused = true
        }
    }

    private func installKeyMonitorIfNeeded() {
        guard keyDownMonitor == nil else { return }

        keyDownMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { event in
            // Tab key toggles Browser/Windows mode while the menu is open.
            // Swallow the event to prevent default focus navigation.
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            let hasDisallowedModifiers = flags.contains(.command) || flags.contains(.option) || flags.contains(.control)
            if hasDisallowedModifiers {
                return event
            }

            let tabKeyCode: UInt16 = 48
            let upArrowKeyCode: UInt16 = 126
            let downArrowKeyCode: UInt16 = 125
            let escapeKeyCode: UInt16 = 53
            let returnKeyCode: UInt16 = 36
            let enterKeypadKeyCode: UInt16 = 76

            // Up/Down: keyboard navigation between the search field and the list items (NOT the mode switch).
            if event.keyCode == upArrowKeyCode || event.keyCode == downArrowKeyCode {
                let items = selectableItemsInCurrentView()
                guard !items.isEmpty else { return event }

                if isSearchFocused {
                    keyboardSelection = (event.keyCode == downArrowKeyCode) ? items.first : items.last
                    isSearchFocused = false
                    return nil
                }

                if let sel = keyboardSelection, let idx = items.firstIndex(of: sel) {
                    if event.keyCode == upArrowKeyCode {
                        if idx == 0 {
                            keyboardSelection = nil
                            focusSearchBar()
                        } else {
                            keyboardSelection = items[idx - 1]
                        }
                    } else {
                        if idx == items.count - 1 {
                            keyboardSelection = nil
                            focusSearchBar()
                        } else {
                            keyboardSelection = items[idx + 1]
                        }
                    }
                    return nil
                }

                // If we have a stale selection, reset back to search.
                keyboardSelection = nil
                focusSearchBar()
                return nil
            }

            // Escape: return to search when navigating list
            if event.keyCode == escapeKeyCode, keyboardSelection != nil {
                keyboardSelection = nil
                focusSearchBar()
                return nil
            }

            // Enter: "click/activate" the currently selected list item
            if (event.keyCode == returnKeyCode || event.keyCode == enterKeypadKeyCode),
               let sel = keyboardSelection {
                activateSelection(sel)
                return nil
            }

            // 'c' key: close selected item
            let cKeyCode: UInt16 = 8
            if event.keyCode == cKeyCode, let sel = keyboardSelection {
                closeSelection(sel)
                return nil
            }

            // 'h' key: hide selected window (windows mode only)
            let hKeyCode: UInt16 = 4
            if event.keyCode == hKeyCode, let sel = keyboardSelection {
                hideSelection(sel)
                return nil
            }

            if event.keyCode == tabKeyCode {
                withAnimation(.easeInOut(duration: 0.15)) {
                    toggleViewMode()
                }
                return nil
            }

            return event
        }
    }

    private func activateSelection(_ sel: KeyboardSelection) {
        switch sel {
        case .domainGroup(let domain):
            viewModel.toggleDomainExpanded(domain)
        case .tab(let id):
            if let tab = viewModel.tabs.first(where: { $0.id == id }) {
                viewModel.activateTab(tab)
            }
        case .recentlyClosedTab(let id):
            if let tab = viewModel.filteredRecentlyClosedTabs.first(where: { $0.id == id }) {
                viewModel.reopenRecentlyClosedTab(tab)
            }
        case .appGroup(let id):
            viewModel.toggleAppExpanded(id)
        case .window(let id):
            if let window = viewModel.windows.first(where: { $0.id == id }) {
                viewModel.activateWindow(window)
            }
        case .hiddenApp(let id):
            if let window = viewModel.windows.first(where: { $0.id == id }) {
                viewModel.activateWindow(window)
            }
        case .recentlyQuit(let id):
            if let app = viewModel.filteredRecentlyQuitApps.first(where: { $0.id == id }) {
                viewModel.relaunchRecentlyQuit(app)
            }
        }
    }

    private func closeSelection(_ sel: KeyboardSelection) {
        switch sel {
        case .domainGroup(let domain):
            // Close all tabs in this domain group
            viewModel.closeAllTabs(inDomain: domain)
            // Move selection to next item or back to search
            moveSelectionAfterRemoval()
        case .tab(let id):
            if let tab = viewModel.tabs.first(where: { $0.id == id }) {
                viewModel.closeTab(tab)
                moveSelectionAfterRemoval()
            }
        case .window(let id):
            if let window = viewModel.windows.first(where: { $0.id == id }) {
                viewModel.closeWindow(window)
                moveSelectionAfterRemoval()
            }
        case .appGroup(let id):
            // Close all windows in this app group (quit the app)
            if let group = viewModel.filteredAppGroups.first(where: { $0.id == id }),
               let firstWindow = group.windows.first {
                viewModel.closeWindow(firstWindow)
                moveSelectionAfterRemoval()
            }
        case .hiddenApp(let id):
            if let window = viewModel.windows.first(where: { $0.id == id }) {
                viewModel.closeWindow(window)
                moveSelectionAfterRemoval()
            }
        case .recentlyClosedTab, .recentlyQuit:
            // No close action for recently closed/quit items
            break
        }
    }

    private func hideSelection(_ sel: KeyboardSelection) {
        switch sel {
        case .window(let id):
            if let window = viewModel.windows.first(where: { $0.id == id }) {
                viewModel.hideWindow(window)
                moveSelectionAfterRemoval()
            }
        case .appGroup(let id):
            // Hide all windows in this app group
            if let group = viewModel.filteredAppGroups.first(where: { $0.id == id }),
               let firstWindow = group.windows.first {
                viewModel.hideWindow(firstWindow)
                moveSelectionAfterRemoval()
            }
        default:
            // Hide only works for windows
            break
        }
    }

    private func moveSelectionAfterRemoval() {
        // After removing an item, try to move to the next available item
        // or go back to search if no items remain
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [self] in
            let items = selectableItemsInCurrentView()
            if items.isEmpty {
                keyboardSelection = nil
                focusSearchBar()
            } else if let currentSel = keyboardSelection,
                      !items.contains(currentSel) {
                // Current selection no longer exists, try to find nearest
                keyboardSelection = items.first
            }
        }
    }

    private func selectableItemsInCurrentView() -> [KeyboardSelection] {
        switch viewModel.viewMode {
        case .browserTabs:
            if viewModel.groupByDomain {
                var items: [KeyboardSelection] = []
                for group in viewModel.domainGroups {
                    items.append(.domainGroup(group.domain))
                    if group.isExpanded {
                        for tab in group.tabs {
                            items.append(.tab(tab.id))
                        }
                    }
                }
                for tab in viewModel.singleTabs {
                    items.append(.tab(tab.id))
                }
                for tab in viewModel.filteredRecentlyClosedTabs {
                    items.append(.recentlyClosedTab(tab.id))
                }
                return items
            }
            var items = viewModel.filteredTabs.map { KeyboardSelection.tab($0.id) }
            items.append(contentsOf: viewModel.filteredRecentlyClosedTabs.map { .recentlyClosedTab($0.id) })
            return items

        case .windows:
            var items: [KeyboardSelection] = []
            for group in viewModel.filteredAppGroups {
                items.append(.appGroup(group.id))
                if viewModel.expandedApps.contains(group.id) {
                    for window in group.windows {
                        items.append(.window(window.id))
                    }
                }
            }
            for window in viewModel.singleWindowApps {
                items.append(.window(window.id))
            }
            for app in viewModel.hiddenApps {
                items.append(.hiddenApp(app.id))
            }
            for app in viewModel.filteredRecentlyQuitApps {
                items.append(.recentlyQuit(app.id))
            }
            return items
        }
    }

    private func removeKeyMonitorIfNeeded() {
        if let keyDownMonitor {
            NSEvent.removeMonitor(keyDownMonitor)
            self.keyDownMonitor = nil
        }
    }

    private func toggleViewMode() {
        switch viewModel.viewMode {
        case .browserTabs:
            viewModel.viewMode = .windows
        case .windows:
            viewModel.viewMode = .browserTabs
        }
    }
    
    // MARK: - Mode Toggle
    
    private var modeToggleView: some View {
        Picker("", selection: $viewModel.viewMode) {
            ForEach(ViewMode.allCases, id: \.self) { mode in
                Label(mode.rawValue, systemImage: mode.icon)
                    .tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .accessibilityLabel("Mode")
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .onChange(of: viewModel.viewMode) { _, newMode in
            if newMode == .windows {
                viewModel.refreshWindows()
            }
        }
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        HStack {
            // Status indicator and info
            switch viewModel.viewMode {
            case .browserTabs:
                HStack(spacing: 6) {
                    Circle()
                        .fill(viewModel.isConnected ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                    
                    Text(viewModel.connectedBrowserNames)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                
            case .windows:
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                    
                    Text("macOS")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            // Count info
            switch viewModel.viewMode {
            case .browserTabs:
                HStack(spacing: 8) {
                    Label("\(viewModel.tabCount)", systemImage: "square.on.square")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Label("\(viewModel.domainCount)", systemImage: "globe")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
            case .windows:
                HStack(spacing: 8) {
                    Label("\(viewModel.windowCount)", systemImage: "macwindow")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
    }
    
    // MARK: - Browser Tabs Content
    
    private var browserTabsContent: some View {
        Group {
            if viewModel.isConnected || !viewModel.tabs.isEmpty {
                tabListSection
            } else if !viewModel.isHostRegistered {
                setupPromptView
            } else {
                waitingForConnectionView
            }
        }
    }
    
    // MARK: - Tab List Section
    
    private var tabListSection: some View {
        VStack(spacing: 0) {
            // Toolbar: Search, Sort, View toggle
            tabToolbarView
            
            // Tab list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if viewModel.groupByDomain {
                            groupedContentView
                        } else {
                            flatListView
                        }

                        if !viewModel.filteredRecentlyClosedTabs.isEmpty {
                            Divider()
                                .padding(.vertical, 4)
                            recentlyClosedTabsSection
                        }
                    }
                }
                .onChange(of: keyboardSelection) { _, newSelection in
                    if let newSelection {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            proxy.scrollTo(newSelection.scrollId, anchor: .center)
                        }
                    }
                }
            }
            .frame(maxHeight: 400)
            
            // Summary footer
            if !viewModel.searchQuery.isEmpty {
                HStack {
                    Text("\(viewModel.filteredTabs.count) of \(viewModel.tabCount) tabs")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
        }
    }

    // MARK: - Recently Closed Tabs (Browser Mode)

    private var recentlyClosedTabsSection: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text("Recently Closed")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)

                Text("(\(viewModel.filteredRecentlyClosedTabs.count))")
                    .font(.caption)
                    .foregroundStyle(.tertiary)

                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.primary.opacity(0.03))

            Divider()

            ForEach(viewModel.filteredRecentlyClosedTabs) { tab in
                RecentlyClosedTabRowView(
                    tab: tab,
                    onReopen: { viewModel.reopenRecentlyClosedTab(tab) },
                    isKeyboardSelected: keyboardSelection == .recentlyClosedTab(tab.id)
                )
                .id(KeyboardSelection.recentlyClosedTab(tab.id).scrollId)

                if tab.id != viewModel.filteredRecentlyClosedTabs.last?.id {
                    Divider()
                        .padding(.leading, 44)
                }
            }
        }
    }
    
    // MARK: - Tab Toolbar
    
    private var tabToolbarView: some View {
        HStack(spacing: 8) {
            // Search field
            searchField
            
            Divider()
                .frame(height: 16)
            
            // Sort order button
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    viewModel.toggleSortOrder()
                }
            } label: {
                HStack(spacing: 2) {
                    Image(systemName: viewModel.sortOrder.icon)
                    Image(systemName: "clock")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .help(viewModel.sortOrder.rawValue)
            
            // Group toggle button
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    viewModel.groupByDomain.toggle()
                }
            } label: {
                Image(systemName: viewModel.groupByDomain ? "rectangle.3.group" : "list.bullet")
                    .font(.caption)
                    .foregroundStyle(viewModel.groupByDomain ? .primary : .secondary)
            }
            .buttonStyle(.plain)
            .help(viewModel.groupByDomain ? "Show as flat list" : "Group by domain")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.primary.opacity(0.05))
    }
    
    // MARK: - Search Field
    
    private var searchField: some View {
        HStack(spacing: 4) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .font(.caption)
            TextField("Search...", text: $viewModel.searchQuery)
                .textFieldStyle(.plain)
                .font(.callout)
                .focused($isSearchFocused)
            
            if !viewModel.searchQuery.isEmpty {
                Button {
                    viewModel.searchQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                }
                .buttonStyle(.plain)
            }
        }
    }
    
    // MARK: - Grouped Content View
    
    private var groupedContentView: some View {
        Group {
            // Domain groups (2+ tabs)
            ForEach(viewModel.domainGroups) { group in
                DomainGroupView(
                    group: group,
                    onToggle: { viewModel.toggleDomainExpanded(group.domain) },
                    onCloseAll: { viewModel.closeAllTabs(inDomain: group.domain) },
                    onTabActivate: { viewModel.activateTab($0) },
                    onTabClose: { viewModel.closeTab($0) },
                    isKeyboardSelected: keyboardSelection == .domainGroup(group.domain),
                    selectedTabId: {
                        if case .tab(let id) = keyboardSelection { return id }
                        return nil
                    }()
                )
                .id(KeyboardSelection.domainGroup(group.domain).scrollId)
                
                Divider()
            }
            
            // Single tabs (no group header)
            ForEach(viewModel.singleTabs) { tab in
                TabRowView(
                    tab: tab,
                    onActivate: { viewModel.activateTab(tab) },
                    onClose: { viewModel.closeTab(tab) },
                    isKeyboardSelected: keyboardSelection == .tab(tab.id)
                )
                .id(KeyboardSelection.tab(tab.id).scrollId)
                
                if tab.id != viewModel.singleTabs.last?.id {
                    Divider()
                        .padding(.leading, 12)
                }
            }
        }
    }
    
    // MARK: - Flat List View
    
    private var flatListView: some View {
        ForEach(viewModel.filteredTabs) { tab in
            TabRowView(
                tab: tab,
                onActivate: { viewModel.activateTab(tab) },
                onClose: { viewModel.closeTab(tab) },
                isKeyboardSelected: keyboardSelection == .tab(tab.id)
            )
            .id(KeyboardSelection.tab(tab.id).scrollId)
            
            if tab.id != viewModel.filteredTabs.last?.id {
                Divider()
                    .padding(.leading, 12)
            }
        }
    }
    
    // MARK: - Windows Content
    
    private var windowsContent: some View {
        VStack(spacing: 0) {
            // Toolbar with search
            windowToolbarView
            
            // Window list
            if viewModel.windows.isEmpty {
                emptyWindowsView
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            // App groups (2+ windows)
                            ForEach(viewModel.filteredAppGroups, id: \.id) { group in
                                let isExpanded = viewModel.expandedApps.contains(group.id)
                                
                                AppGroupView(
                                    group: group,
                                    isExpanded: isExpanded,
                                    onToggle: { viewModel.toggleAppExpanded(group.id) },
                                    onWindowActivate: { viewModel.activateWindow($0) },
                                    onWindowHide: { viewModel.hideWindow($0) },
                                    onWindowClose: { viewModel.closeWindow($0) },
                                    isKeyboardSelected: keyboardSelection == .appGroup(group.id),
                                    selectedWindowId: {
                                        if case .window(let id) = keyboardSelection { return id }
                                        return nil
                                    }()
                            )
                            .id(KeyboardSelection.appGroup(group.id).scrollId)
                            
                            Divider()
                        }
                        
                        // Single-window apps (no group header)
                        ForEach(viewModel.singleWindowApps) { window in
                            WindowRowView(
                                window: window,
                                showAppName: true,
                                onActivate: { viewModel.activateWindow(window) },
                                onHide: { viewModel.hideWindow(window) },
                                onClose: { viewModel.closeWindow(window) },
                                isKeyboardSelected: keyboardSelection == .window(window.id)
                            )
                            .id(KeyboardSelection.window(window.id).scrollId)
                                
                                if window.id != viewModel.singleWindowApps.last?.id {
                                    Divider()
                                        .padding(.leading, 12)
                                }
                            }
                            
                            // Hidden apps section (separated from visible apps)
                            if !viewModel.hiddenApps.isEmpty {
                                // Add separator between visible and hidden apps
                                if !viewModel.filteredAppGroups.isEmpty || !viewModel.singleWindowApps.isEmpty {
                                    Divider()
                                        .padding(.vertical, 4)
                                }
                                hiddenAppsSection
                            }
                            
                            // Recently Quit section
                            if !viewModel.filteredRecentlyQuitApps.isEmpty {
                                Divider()
                                    .padding(.vertical, 4)
                                recentlyQuitSection
                            }
                        }
                    }
                    .onChange(of: keyboardSelection) { _, newSelection in
                        if let newSelection {
                            withAnimation(.easeInOut(duration: 0.15)) {
                                proxy.scrollTo(newSelection.scrollId, anchor: .center)
                            }
                        }
                    }
                }
                .frame(maxHeight: 400)
            }
            
            // Summary footer
            if !viewModel.searchQuery.isEmpty && !viewModel.windows.isEmpty {
                HStack {
                    Text("\(viewModel.filteredWindows.count) of \(viewModel.windowCount) windows")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
        }
    }
    
    // MARK: - Hidden Apps Section
    
    private var hiddenAppsSection: some View {
        VStack(spacing: 0) {
            // Section header
            HStack {
                Image(systemName: "eye.slash")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Text("Hidden Apps")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                
                Text("(\(viewModel.hiddenApps.count))")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.primary.opacity(0.03))
            
            Divider()
            
            // Hidden apps list
            ForEach(viewModel.hiddenApps) { app in
                HiddenAppRowView(
                    app: app,
                    onShow: { viewModel.activateWindow(app) },
                    isKeyboardSelected: keyboardSelection == .hiddenApp(app.id)
                )
                .id(KeyboardSelection.hiddenApp(app.id).scrollId)
                
                if app.id != viewModel.hiddenApps.last?.id {
                    Divider()
                        .padding(.leading, 44)
                }
            }
        }
    }
    
    // MARK: - Recently Quit Section
    
    private var recentlyQuitSection: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Text("Recently Quit")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                
                Text("(\(viewModel.filteredRecentlyQuitApps.count))")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.primary.opacity(0.03))
            
            Divider()
            
            ForEach(viewModel.filteredRecentlyQuitApps) { app in
                RecentlyQuitRowView(
                    app: app,
                    onRelaunch: { viewModel.relaunchRecentlyQuit(app) },
                    isKeyboardSelected: keyboardSelection == .recentlyQuit(app.id)
                )
                .id(KeyboardSelection.recentlyQuit(app.id).scrollId)
                
                if app.id != viewModel.filteredRecentlyQuitApps.last?.id {
                    Divider()
                        .padding(.leading, 44)
                }
            }
        }
    }
    
    // MARK: - Window Toolbar
    
    private var windowToolbarView: some View {
        HStack(spacing: 8) {
            // Search field
            searchField
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.primary.opacity(0.05))
    }
    
    // MARK: - Empty Windows View
    
    private var emptyWindowsView: some View {
        VStack(spacing: 12) {
            Image(systemName: "macwindow")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            
            Text("No windows found")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Text("Open some apps to see their windows here.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Setup Prompt
    
    private var setupPromptView: some View {
        VStack(spacing: 12) {
            Image(systemName: "link")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            
            Text("Setup Required")
                .font(.headline)
            
            Text("Open Settings to configure the browser extension connection")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            SettingsLink {
                Text("Open Settings")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Waiting for Connection
    
    private var waitingForConnectionView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(0.8)
            
            Text("Waiting for browser extension...")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Text("Make sure the TabDog extension is installed and enabled in Chrome/Brave.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Footer
    
    private var footerView: some View {
        HStack {
            // Refresh button
            Button {
                viewModel.requestUpdate()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.plain)
            .help("Refresh")
            
            Spacer()
            
            // Expand/Collapse all (context-dependent)
            expandCollapseButton
            
            // Settings
            SettingsLink {
                Image(systemName: "gear")
            }
            .buttonStyle(.plain)
            .help("Settings")
            
            // Quit button
            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                Image(systemName: "power")
            }
            .buttonStyle(.plain)
            .help("Quit TabDog")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
    
    // MARK: - Expand/Collapse Button
    
    @ViewBuilder
    private var expandCollapseButton: some View {
        switch viewModel.viewMode {
        case .browserTabs:
            if viewModel.groupByDomain && !viewModel.domainGroups.isEmpty {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if viewModel.expandedDomains.isEmpty {
                            viewModel.expandAllDomains()
                        } else {
                            viewModel.collapseAllDomains()
                        }
                    }
                } label: {
                    Image(systemName: viewModel.expandedDomains.isEmpty ? "chevron.down.2" : "chevron.up.2")
                }
                .buttonStyle(.plain)
                .help(viewModel.expandedDomains.isEmpty ? "Expand all" : "Collapse all")
            }
            
        case .windows:
            if !viewModel.appGroups.isEmpty {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if viewModel.expandedApps.isEmpty {
                            viewModel.expandAllApps()
                        } else {
                            viewModel.collapseAllApps()
                        }
                    }
                } label: {
                    Image(systemName: viewModel.expandedApps.isEmpty ? "chevron.down.2" : "chevron.up.2")
                }
                .buttonStyle(.plain)
                .help(viewModel.expandedApps.isEmpty ? "Expand all" : "Collapse all")
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
#Preview {
    MenuBarView(viewModel: {
        let vm = TabViewModel()
        vm.loadSampleData()
        return vm
    }())
}
#endif