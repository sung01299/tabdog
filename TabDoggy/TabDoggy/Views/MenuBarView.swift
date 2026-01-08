//
//  MenuBarView.swift
//  TabDoggy
//
//  Main menu bar content view
//

import SwiftUI

struct MenuBarView: View {
    @Bindable var viewModel: TabViewModel
    @FocusState private var isSearchFocused: Bool
    
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
        }
        .onChange(of: viewModel.viewMode) { _, _ in
            // Re-focus search bar when mode changes
            focusSearchBar()
        }
    }
    
    // MARK: - Helper Methods
    
    private func focusSearchBar() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            isSearchFocused = true
        }
    }
    
    // MARK: - Mode Toggle
    
    private var modeToggleView: some View {
        Picker("Mode", selection: $viewModel.viewMode) {
            ForEach(ViewMode.allCases, id: \.self) { mode in
                Label(mode.rawValue, systemImage: mode.icon)
                    .tag(mode)
            }
        }
        .pickerStyle(.segmented)
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
                    
                    Text("macOS Windows")
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
                    
                    Label("\(viewModel.appCount)", systemImage: "app")
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
            ScrollView {
                LazyVStack(spacing: 0) {
                    if viewModel.groupByDomain {
                        groupedContentView
                    } else {
                        flatListView
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
                    onTabClose: { viewModel.closeTab($0) }
                )
                
                Divider()
            }
            
            // Single tabs (no group header)
            ForEach(viewModel.singleTabs) { tab in
                TabRowView(
                    tab: tab,
                    onActivate: { viewModel.activateTab(tab) },
                    onClose: { viewModel.closeTab(tab) }
                )
                
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
                onClose: { viewModel.closeTab(tab) }
            )
            
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
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // App groups (2+ windows)
                        ForEach(viewModel.filteredAppGroups) { group in
                            let isExpanded = viewModel.expandedApps.contains(group.id)
                            
                            AppGroupView(
                                group: group,
                                isExpanded: isExpanded,
                                onToggle: { viewModel.toggleAppExpanded(group.id) },
                                onWindowActivate: { viewModel.activateWindow($0) },
                                onWindowHide: { viewModel.hideWindow($0) },
                                onWindowClose: { viewModel.closeWindow($0) }
                            )
                            
                            Divider()
                        }
                        
                        // Single-window apps (no group header)
                        ForEach(viewModel.singleWindowApps) { window in
                            WindowRowView(
                                window: window,
                                showAppName: true,
                                onActivate: { viewModel.activateWindow(window) },
                                onHide: { viewModel.hideWindow(window) },
                                onClose: { viewModel.closeWindow(window) }
                            )
                            
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
                    onShow: { viewModel.activateWindow(app) }
                )
                
                if app.id != viewModel.hiddenApps.last?.id {
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
            Image(systemName: "link.badge.plus")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            
            Text("Setup Required")
                .font(.headline)
            
            Text("Open Settings to configure the browser extension connection.")
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
            
            Text("Make sure the TabDoggy extension is installed and enabled in Chrome/Brave.")
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
            .help("Quit TabDoggy")
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

#Preview {
    MenuBarView(viewModel: {
        let vm = TabViewModel()
        vm.loadSampleData()
        return vm
    }())
}
