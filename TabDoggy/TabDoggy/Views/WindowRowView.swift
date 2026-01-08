//
//  WindowRowView.swift
//  TabDoggy
//
//  View for displaying a single macOS window in the list
//

import SwiftUI

struct WindowRowView: View {
    let window: WindowInfo
    let showAppName: Bool  // Whether to show app name (false when in app group)
    let onActivate: () -> Void
    let onHide: () -> Void
    let onClose: () -> Void
    
    @State private var isHovered = false
    @State private var processInfo: ProcessResourceInfo?
    
    private let processInfoService = ProcessInfoService.shared
    
    init(window: WindowInfo, showAppName: Bool = true, onActivate: @escaping () -> Void, onHide: @escaping () -> Void, onClose: @escaping () -> Void) {
        self.window = window
        self.showAppName = showAppName
        self.onActivate = onActivate
        self.onHide = onHide
        self.onClose = onClose
    }
    
    var body: some View {
        HStack(spacing: 8) {
            // App icon
            if let icon = window.appIcon {
                Image(nsImage: icon)
                    .resizable()
                    .frame(width: 20, height: 20)
            } else {
                Image(systemName: "macwindow")
                    .frame(width: 20, height: 20)
                    .foregroundStyle(.secondary)
            }
            
            // Window info
            VStack(alignment: .leading, spacing: 2) {
                Text(window.truncatedTitle(maxLength: 35))
                    .font(.callout)
                    .lineLimit(1)
                
                if showAppName {
                    Text(window.ownerName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            // Resource usage (memory and CPU)
            if !isHovered, let info = processInfo {
                resourceUsageView(info: info)
            }
            
            // Action buttons (show on hover)
            if isHovered {
                HStack(spacing: 4) {
                    // Minimize button (same as yellow window button)
                    Button {
                        onHide()
                    } label: {
                        Image(systemName: "minus.square")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("Minimize window")
                    
                    // Close button
                    Button {
                        onClose()
                    } label: {
                        Image(systemName: "xmark.circle")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("Close window")
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .background(isHovered ? Color.primary.opacity(0.05) : Color.clear)
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            onActivate()
        }
        .onAppear {
            loadProcessInfo()
        }
        .onReceive(Timer.publish(every: 3.0, on: .main, in: .common).autoconnect()) { _ in
            loadProcessInfo()
        }
    }
    
    // MARK: - Resource Usage View
    
    @ViewBuilder
    private func resourceUsageView(info: ProcessResourceInfo) -> some View {
        HStack(spacing: 6) {
            // Memory usage
            HStack(spacing: 2) {
                Image(systemName: "memorychip")
                    .font(.system(size: 8))
                Text(info.formattedMemory)
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
            }
            .foregroundStyle(memoryColor(for: info.memoryMB))
            .help("Memory: \(info.formattedMemory)")
            
            // CPU usage (only show if significant)
            if info.cpuPercent >= 0.1 {
                HStack(spacing: 2) {
                    Image(systemName: "cpu")
                        .font(.system(size: 8))
                    Text(info.formattedCPU)
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                }
                .foregroundStyle(cpuColor(for: info.cpuPercent))
                .help("CPU: \(info.formattedCPU)")
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func loadProcessInfo() {
        processInfo = processInfoService.getProcessInfo(pid: window.ownerPID)
    }
    
    private func memoryColor(for mb: Double) -> Color {
        if mb < 200 {
            return .secondary
        } else if mb < 500 {
            return .orange
        } else {
            return .red
        }
    }
    
    private func cpuColor(for percent: Double) -> Color {
        if percent < 10 {
            return .secondary
        } else if percent < 50 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - App Group View

struct AppGroupView: View {
    let group: AppWindowGroup
    let isExpanded: Bool
    let onToggle: () -> Void
    let onWindowActivate: (WindowInfo) -> Void
    let onWindowHide: (WindowInfo) -> Void
    let onWindowClose: (WindowInfo) -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Group header
            HStack(spacing: 8) {
                // Expand/collapse chevron
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 12)
                
                // App icon
                if let icon = group.appIcon {
                    Image(nsImage: icon)
                        .resizable()
                        .frame(width: 18, height: 18)
                } else {
                    Image(systemName: "app")
                        .frame(width: 18, height: 18)
                        .foregroundStyle(.secondary)
                }
                
                // App name
                Text(group.appName)
                    .font(.callout)
                    .fontWeight(.medium)
                
                // Window count
                Text("(\(group.windowCount))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
            .background(isHovered ? Color.primary.opacity(0.05) : Color.clear)
            .onHover { hovering in
                isHovered = hovering
            }
            .onTapGesture {
                withAnimation(.easeInOut(duration: 0.2)) {
                    onToggle()
                }
            }
            
            // Expanded windows
            if isExpanded {
                VStack(spacing: 0) {
                    ForEach(group.windows) { window in
                        WindowRowView(
                            window: window,
                            showAppName: false,  // Don't show app name inside group
                            onActivate: { onWindowActivate(window) },
                            onHide: { onWindowHide(window) },
                            onClose: { onWindowClose(window) }
                        )
                        .padding(.leading, 20)
                        
                        if window.id != group.windows.last?.id {
                            Divider()
                                .padding(.leading, 44)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Hidden App Row View

struct HiddenAppRowView: View {
    let app: WindowInfo
    let onShow: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        HStack(spacing: 8) {
            // App icon
            if let icon = app.appIcon {
                Image(nsImage: icon)
                    .resizable()
                    .frame(width: 20, height: 20)
                    .opacity(0.6)
            } else {
                Image(systemName: "app")
                    .frame(width: 20, height: 20)
                    .foregroundStyle(.tertiary)
            }
            
            // App name
            Text(app.ownerName)
                .font(.callout)
                .foregroundStyle(.secondary)
            
            Spacer()
            
            // Show button
            if isHovered {
                Button {
                    onShow()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "eye")
                        Text("Show")
                    }
                    .font(.caption)
                    .foregroundStyle(.blue)
                }
                .buttonStyle(.plain)
                .help("Show app")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .background(isHovered ? Color.primary.opacity(0.05) : Color.clear)
        .onHover { hovering in
            isHovered = hovering
        }
        .onTapGesture {
            onShow()
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 0) {
        WindowRowView(
            window: WindowInfo.sample,
            onActivate: {},
            onHide: {},
            onClose: {}
        )
        Divider()
        AppGroupView(
            group: AppWindowGroup(
                appName: "Finder",
                pid: 1234,
                windows: WindowInfo.samples,
                isExpanded: true
            ),
            isExpanded: true,
            onToggle: {},
            onWindowActivate: { _ in },
            onWindowHide: { _ in },
            onWindowClose: { _ in }
        )
    }
    .frame(width: 400)
}

