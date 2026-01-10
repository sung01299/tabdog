//
//  SettingsView.swift
//  TabDog
//
//  Settings window for configuring the app
//

import SwiftUI

struct SettingsView: View {
    @Bindable var viewModel: TabViewModel
    @State private var showingRegistrationSuccess = false
    @State private var launchAtLogin = LaunchAtLoginService.shared
    
    var body: some View {
        TabView {
            // Connection Tab
            connectionSettingsView
                .tabItem {
                    Label("Connection", systemImage: "link")
                }
            
            // General Tab
            generalSettingsView
                .tabItem {
                    Label("General", systemImage: "gear")
                }
            
            // About Tab
            aboutView
                .tabItem {
                    Label("Information", systemImage: "info.circle")
                }
        }
        .frame(width: 480, height: 470)
    }
    
    // MARK: - General Settings
    
    private var generalSettingsView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                GroupBox {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Preferences")
                            .font(.headline)
                        
                        HStack(alignment: .center, spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(Color.primary.opacity(0.08))
                                    .frame(width: 26, height: 26)
                                Image(systemName: "power")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.secondary)
                            }
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Launch at Login")
                                    .font(.callout.weight(.medium))
                                Text("Start TabDog automatically when you log in")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            
                            Spacer()
                            
                            Toggle("", isOn: Binding(
                                get: { launchAtLogin.isEnabled },
                                set: { launchAtLogin.isEnabled = $0 }
                            ))
                            .toggleStyle(.switch)
                            .labelsHidden()
                        }
                        .padding(.vertical, 4)
                    }
                    .padding(8)
                }
                
                Spacer(minLength: 0)
            }
            .padding(20)
        }
        .background(Color(NSColor.windowBackgroundColor))
    }
    
    // MARK: - Connection Settings
    
    private var connectionSettingsView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                stepsCard
                verificationCard
            }
            .padding(20)
        }
        .background(Color(NSColor.windowBackgroundColor))
        .onAppear { viewModel.checkHostRegistration() }
        .alert("Setup Complete", isPresented: $showingRegistrationSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Native Messaging Host manifests were installed. If your browser was already running, restart it once.")
        }
    }
    
    // MARK: - Connection UI Pieces
    
    private var headerCard: some View {
        GroupBox {
            HStack(alignment: .center) {
                Text("Connection Status")
                    .font(.headline)
                
                Spacer()
                
                statusPill
            }
            .padding(8)
        }
    }
    
    private var statusPill: some View {
        Group {
            if viewModel.isHostRegistered {
                Text("Ready")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.green)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.green.opacity(0.12))
                    .clipShape(Capsule())
            } else {
                Text("Not Ready")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.orange.opacity(0.12))
                    .clipShape(Capsule())
            }
        }
        .accessibilityLabel(viewModel.isHostRegistered ? "Ready" : "Not Ready")
    }
    
    private var stepsCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Setup")
                        .font(.headline)
                    Spacer()
                    Button {
                        viewModel.checkHostRegistration()
                    } label: {
                        Text("Refresh").font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                
                stepRow(
                    number: 1,
                    title: "Install the Extension",
                    systemImage: "puzzlepiece.extension",
                    trailing: AnyView(extensionLinkButton)
                )
                
                Divider().opacity(0.6)
                
                stepRow(
                    number: 2,
                    title: "One-click Setup",
                    systemImage: "wand.and.stars",
                    trailing: AnyView(setupButtons)
                )
                
                if let error = viewModel.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding(.top, 4)
                }
            }
            .padding(8)
        }
    }
    
    private func stepRow(number: Int, title: String, systemImage: String, trailing: AnyView) -> some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.primary.opacity(0.08))
                    .frame(width: 26, height: 26)
                Text("\(number)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.callout.weight(.medium))
            }
            
            Spacer()
            
            trailing
        }
        .padding(.vertical, 4)
    }
    
    private var extensionLinkButton: some View {
        Group {
            if let url = HostRegistrationService.extensionStoreURL {
                Link(destination: url) {
                    Text("Open Store")
                        .frame(minWidth: 96)
                }
                .buttonStyle(.bordered)
            } else {
                Text("Store URL missing")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    private var setupButtons: some View {
        HStack(spacing: 8) {
            Button(viewModel.isHostRegistered ? "Re-run" : "Setup") {
                viewModel.registerHost()
                if viewModel.isHostRegistered {
                    showingRegistrationSuccess = true
                }
            }
            .buttonStyle(.bordered)
            
            Button("Uninstall") {
                viewModel.unregisterHost()
            }
            .buttonStyle(.bordered)
            .tint(.red)
        }
    }
    
    private var verificationCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                Text("Verification")
                    .font(.headline)
                
                HStack {
                    Text("Connected Browsers")
                    Spacer()
                    Text(viewModel.connectedBrowserNames)
                        .foregroundStyle(.secondary)
                }
                .font(.callout)
                
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(HostRegistrationService.Browser.allCases) { browser in
                        let ok = viewModel.hostRegistrationStatus[browser] ?? false
                        HStack(spacing: 8) {
                            Image(systemName: ok ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(ok ? .green : .secondary)
                            Text(browser.displayName)
                            Spacer()
                            Text(ok ? "Ready" : "Not installed")
                                .font(.caption)
                                .foregroundStyle(ok ? .secondary : .tertiary)
                        }
                    }
                }
                .font(.callout)
            }
            .padding(8)
        }
    }
    
    // MARK: - About View
    
    private var aboutView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                GroupBox {
                    HStack(alignment: .center, spacing: 14) {
                        if let appIcon = NSApp.applicationIconImage {
                            Image(nsImage: appIcon)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 48, height: 48)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("TabDog")
                                .font(.title3.weight(.bold))
                            
                            Text(appVersionText)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Text("Monitor and control browser tabs from your menu bar")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                    }
                    .padding(8)
                }
                
                GroupBox {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Links")
                            .font(.headline)
                        
                        HStack(spacing: 12) {
                            Link(destination: URL(string: "https://github.com/sung01299/tabdog")!) {
                                Label("GitHub", systemImage: "chevron.left.forwardslash.chevron.right")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            
                            Link(destination: URL(string: "https://github.com/sung01299/tabdog/issues")!) {
                                Label("Report Issue", systemImage: "ladybug")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    .padding(8)
                }
                
                Spacer(minLength: 0)
                
                Text("© 2026 TabDog Contributors")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 8)
            }
            .padding(20)
        }
        .background(Color(NSColor.windowBackgroundColor))
    }
    
    private var appVersionText: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "Version \(version) (\(build))"
    }
}

// MARK: - Preview

#if DEBUG
#Preview {
    SettingsView(viewModel: TabViewModel())
}
#endif

