//
//  TabRowView.swift
//  TabDoggy
//
//  Individual tab row in the menu bar list
//

import SwiftUI

struct TabRowView: View {
    let tab: Tab
    let onActivate: () -> Void
    let onClose: () -> Void
    
    @State private var isHovering = false
    
    var body: some View {
        HStack(spacing: 10) {
            // Tab icon
            tabIcon
            
            // Tab info
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    // Pinned indicator
                    if tab.pinned {
                        Image(systemName: "pin.fill")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    }
                    
                    // Active indicator
                    if tab.active {
                        Circle()
                            .fill(.blue)
                            .frame(width: 6, height: 6)
                    }
                    
                    // Title
                    Text(tab.truncatedTitle())
                        .font(.system(.body, design: .default))
                        .lineLimit(1)
                }
                
                // URL domain, browser, and duration
                HStack(spacing: 6) {
                    Text(tab.domain)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    
                    // Browser badge (if known)
                    if let browser = tab.browser, browser != "unknown" {
                        Text("•")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        
                        Text(tab.browserDisplayName)
                            .font(.caption)
                            .foregroundStyle(browserColor(for: browser))
                    }
                    
                    // Duration badge
                    if !tab.formattedDuration.isEmpty {
                        Text("•")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        
                        HStack(spacing: 2) {
                            Image(systemName: "clock")
                                .font(.caption2)
                            Text(tab.formattedDuration)
                                .font(.caption)
                        }
                        .foregroundStyle(.tertiary)
                    }
                }
            }
            
            Spacer()
            
            // Close button (visible on hover)
            if isHovering {
                Button {
                    onClose()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Close tab")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .background(isHovering ? Color.primary.opacity(0.05) : Color.clear)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovering = hovering
            }
        }
        .onTapGesture {
            onActivate()
        }
        .contextMenu {
            contextMenuItems
        }
    }
    
    // MARK: - Tab Icon
    
    private var tabIcon: some View {
        Group {
            if let favIconUrl = tab.favIconUrl,
               let url = URL(string: favIconUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                    default:
                        defaultIcon
                    }
                }
            } else {
                defaultIcon
            }
        }
        .frame(width: 16, height: 16)
    }
    
    private var defaultIcon: some View {
        Image(systemName: "globe")
            .foregroundStyle(.secondary)
    }
    
    // MARK: - Browser Color
    
    private func browserColor(for browser: String) -> Color {
        switch browser.lowercased() {
        case "chrome": return .blue
        case "brave": return .orange
        case "edge": return .cyan
        case "opera": return .red
        case "vivaldi": return .pink
        default: return .secondary
        }
    }
    
    // MARK: - Context Menu
    
    @ViewBuilder
    private var contextMenuItems: some View {
        Button("Open in Chrome") {
            onActivate()
        }
        
        Divider()
        
        Button("Close Tab", role: .destructive) {
            onClose()
        }
        
        Divider()
        
        Button("Copy URL") {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(tab.url, forType: .string)
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 0) {
        ForEach(Tab.samples) { tab in
            TabRowView(
                tab: tab,
                onActivate: {},
                onClose: {}
            )
            Divider()
        }
    }
    .frame(width: 360)
}
