//
//  SettingsView.swift
//  TabDoggy
//
//  Settings window for configuring the app
//

import SwiftUI

struct SettingsView: View {
    @Bindable var viewModel: TabViewModel
    @State private var showingRegistrationSuccess = false
    
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
        .frame(width: 450, height: 300)
    }
    
    // MARK: - Connection Settings
    
    private var connectionSettingsView: some View {
        Form {
            Section {
                // Registration status
                HStack {
                    Text("Native Messaging Host")
                    Spacer()
                    if viewModel.isHostRegistered {
                        Label("Registered", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else {
                        Label("Not Registered", systemImage: "xmark.circle.fill")
                            .foregroundStyle(.red)
                    }
                }
                
                // Extension ID input
                LabeledContent("Extension ID") {
                    TextField("e.g., abcdefghijklmnopqrstuvwxyz", text: $viewModel.extensionId)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 280)
                        .disabled(viewModel.isHostRegistered)
                }
                
                // Help text
                Text("Enter your Chrome extension ID. You can find it in chrome://extensions with Developer mode enabled.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
            } header: {
                Text("Chrome Extension Connection")
            }
            
            Section {
                // Registration buttons
                HStack {
                    if viewModel.isHostRegistered {
                        Button("Unregister Host") {
                            viewModel.unregisterHost()
                        }
                        .foregroundStyle(.red)
                    } else {
                        Button("Register Host") {
                            viewModel.registerHost()
                            if viewModel.isHostRegistered {
                                showingRegistrationSuccess = true
                            }
                        }
                        .disabled(viewModel.extensionId.isEmpty)
                    }
                    
                    Spacer()
                    
                    Button("Refresh Status") {
                        viewModel.checkHostRegistration()
                    }
                }
                
                // Error message
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            
            Section {
                // Host manifest path info
                LabeledContent("Manifest Path") {
                    Text(HostRegistrationService.hostManifestPath.path)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            } header: {
                Text("Debug Info")
            }
        }
        .formStyle(.grouped)
        .padding()
        .alert("Host Registered", isPresented: $showingRegistrationSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("The Native Messaging Host has been registered. Please restart Chrome for the changes to take effect.")
        }
    }
    
    // MARK: - About View
    
    private var aboutView: some View {
        VStack(spacing: 16) {
            // App icon
            Image(systemName: "dog.fill")
                .font(.system(size: 64))
                .foregroundStyle(.primary)
            
            // App name and version
            Text("TabDoggy")
                .font(.title)
                .fontWeight(.bold)
            
            Text("Version 1.0.0")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Text("Monitor and control Chrome tabs from your menu bar")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            Divider()
                .frame(width: 200)
            
            // Links
            HStack(spacing: 20) {
                Link("GitHub", destination: URL(string: "https://github.com/user/tab-doggy")!)
                Link("Report Issue", destination: URL(string: "https://github.com/user/tab-doggy/issues")!)
            }
            .font(.caption)
            
            Spacer()
            
            // Copyright
            Text("© 2026 TabDoggy Contributors")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(30)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Preview

#Preview {
    SettingsView(viewModel: TabViewModel())
}

