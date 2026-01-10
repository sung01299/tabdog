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
    @State private var showAdvanced = false
    
    var body: some View {
        TabView {
            // Connection Tab
            connectionSettingsView
                .tabItem {
                    Label("Connection", systemImage: "link")
                }
            
            // About Tab
            aboutView
                .tabItem {
                    Label("About", systemImage: "info.circle")
                }
        }
        .frame(width: 520, height: 380)
    }
    
    // MARK: - Connection Settings
    
    private var connectionSettingsView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                headerCard
                
                stepsCard
                
                verificationCard
                
                DisclosureGroup(isExpanded: $showAdvanced) {
                    advancedCard
                        .padding(.top, 8)
                } label: {
                    Label("Advanced", systemImage: "wrench.and.screwdriver")
                        .font(.callout.weight(.semibold))
                }
                .padding(.top, 4)
            }
            .padding(16)
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
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "link.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.blue)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Connect TabDog to your browser")
                        .font(.headline)
                    
                    Text("Install the extension, then run Setup once. No manual IDs.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                statusPill
            }
        }
    }
    
    private var statusPill: some View {
        Group {
            if viewModel.isHostRegistered {
                Label("Ready", systemImage: "checkmark.seal.fill")
                    .labelStyle(.titleAndIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.green)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.green.opacity(0.12))
                    .clipShape(Capsule())
            } else {
                Label("Not set up", systemImage: "exclamationmark.triangle.fill")
                    .labelStyle(.titleAndIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.orange.opacity(0.12))
                    .clipShape(Capsule())
            }
        }
        .accessibilityLabel(viewModel.isHostRegistered ? "Ready" : "Not set up")
    }
    
    private var stepsCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Setup")
                        .font(.callout.weight(.semibold))
                    Spacer()
                    Button("Refresh") { viewModel.checkHostRegistration() }
                        .buttonStyle(.borderless)
                }
                
                stepRow(
                    number: 1,
                    title: "Install the Extension",
                    subtitle: "This enables tab access and Native Messaging.",
                    systemImage: "puzzlepiece.extension",
                    trailing: AnyView(extensionLinkButton)
                )
                
                Divider().opacity(0.6)
                
                stepRow(
                    number: 2,
                    title: "One‑click Setup",
                    subtitle: "Installs Native Messaging host manifests for supported browsers.",
                    systemImage: "wand.and.stars",
                    trailing: AnyView(setupButtons)
                )
                
                if let error = viewModel.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding(.top, 2)
                }
                
                Text("Tip: If your browser was already open, restart it once after Setup.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    private func stepRow(number: Int, title: String, subtitle: String, systemImage: String, trailing: AnyView) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.primary.opacity(0.08))
                    .frame(width: 28, height: 28)
                Text("\(number)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Image(systemName: systemImage)
                        .foregroundStyle(.secondary)
                    Text(title)
                        .font(.callout.weight(.semibold))
                }
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            trailing
        }
        .padding(.vertical, 2)
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
            .buttonStyle(.borderedProminent)
            
            Button("Uninstall") {
                viewModel.unregisterHost()
            }
            .buttonStyle(.bordered)
            .tint(.red)
        }
    }
    
    private var verificationCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 10) {
                Text("Verification")
                    .font(.callout.weight(.semibold))
                
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
                            Text(ok ? "Installed" : "Not installed")
                                .font(.caption)
                                .foregroundStyle(ok ? .secondary : .tertiary)
                        }
                    }
                }
                .font(.callout)
                
                Divider().opacity(0.6)
                
                HStack {
                    Text("Extension ID")
                    Spacer()
                    Text(HostRegistrationService.productionExtensionId)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
        }
    }
    
    private var advancedCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 10) {
                Text("Manifest Paths")
                    .font(.callout.weight(.semibold))
                
                ForEach(HostRegistrationService.Browser.allCases) { browser in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(browser.displayName)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        
                        Text(HostRegistrationService.hostManifestPath(for: browser).path)
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                    if browser.id != HostRegistrationService.Browser.allCases.last?.id {
                        Divider().opacity(0.4)
                    }
                }
            }
        }
    }
    
    // MARK: - About View
    
    private var aboutView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                GroupBox {
                    HStack(alignment: .center, spacing: 14) {
                        Image(systemName: "dog.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(.primary)
                            .padding(10)
                            .background(Color.primary.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("TabDog")
                                .font(.title3.weight(.bold))
                            
                            Text(appVersionText)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Text("Monitor and control browser tabs from your menu bar.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                    }
                }
                
                GroupBox {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Links")
                            .font(.callout.weight(.semibold))
                        
                        HStack(spacing: 10) {
                            Link(destination: URL(string: "https://github.com/user/tab-doggy")!) {
                                Label("GitHub", systemImage: "chevron.left.forwardslash.chevron.right")
                                    .frame(minWidth: 140)
                            }
                            .buttonStyle(.bordered)
                            
                            Link(destination: URL(string: "https://github.com/user/tab-doggy/issues")!) {
                                Label("Report Issue", systemImage: "ladybug")
                                    .frame(minWidth: 140)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
                
                GroupBox {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("System")
                            .font(.callout.weight(.semibold))
                        
                        HStack {
                            Text("Extension ID")
                            Spacer()
                            Text(HostRegistrationService.productionExtensionId)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                        }
                        .font(.callout)
                    }
                }
                
                Spacer(minLength: 0)
                
                Text("© 2026 TabDog Contributors")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 6)
            }
            .padding(16)
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

#Preview {
    SettingsView(viewModel: TabViewModel())
}

