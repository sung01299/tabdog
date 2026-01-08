//
//  DomainGroupView.swift
//  TabDoggy
//
//  Collapsible domain group showing tabs from the same domain
//

import SwiftUI

struct DomainGroupView: View {
    let group: DomainGroup
    let onToggle: () -> Void
    let onCloseAll: () -> Void
    let onTabActivate: (Tab) -> Void
    let onTabClose: (Tab) -> Void
    
    @State private var isHoveringHeader = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Domain header
            headerView
            
            // Tabs (when expanded)
            if group.isExpanded {
                ForEach(group.tabs) { tab in
                    VStack(spacing: 0) {
                        TabRowView(
                            tab: tab,
                            onActivate: { onTabActivate(tab) },
                            onClose: { onTabClose(tab) }
                        )
                        .padding(.leading, 8)  // Indent tabs under domain
                        
                        if tab.id != group.tabs.last?.id {
                            Divider()
                                .padding(.leading, 20)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Header View
    
    private var headerView: some View {
        HStack(spacing: 8) {
            // Expand/collapse chevron
            Image(systemName: group.isExpanded ? "chevron.down" : "chevron.right")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 12)
            
            // Active indicator if this group contains the active tab
            if group.tabs.contains(where: { $0.active }) {
                Circle()
                    .fill(.blue)
                    .frame(width: 6, height: 6)
            }
            
            // Domain favicon placeholder
            Image(systemName: "globe")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            // Domain name
            Text(group.domain)
                .font(.system(.body, weight: .medium))
                .lineLimit(1)
            
            // Tab count badge
            Text("\(group.tabCount)")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.primary.opacity(0.1))
                .clipShape(Capsule())
            
            Spacer()
            
            // Close all button (on hover)
            if isHoveringHeader {
                Button {
                    onCloseAll()
                } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "xmark")
                        Text("Close All")
                    }
                    .font(.caption)
                    .foregroundStyle(.red)
                }
                .buttonStyle(.plain)
                .help("Close all \(group.tabCount) tabs from \(group.domain)")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isHoveringHeader ? Color.primary.opacity(0.05) : Color.primary.opacity(0.02))
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.2)) {
                onToggle()
            }
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHoveringHeader = hovering
            }
        }
        .contextMenu {
            Button("Close All Tabs from \(group.domain)") {
                onCloseAll()
            }
            
            Divider()
            
            Button(group.isExpanded ? "Collapse" : "Expand") {
                onToggle()
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 0) {
        DomainGroupView(
            group: DomainGroup(
                domain: "github.com",
                tabs: Array(Tab.samples.prefix(2)),
                isExpanded: true
            ),
            onToggle: {},
            onCloseAll: {},
            onTabActivate: { _ in },
            onTabClose: { _ in }
        )
        
        Divider()
        
        DomainGroupView(
            group: DomainGroup(
                domain: "google.com",
                tabs: Array(Tab.samples.suffix(2)),
                isExpanded: false
            ),
            onToggle: {},
            onCloseAll: {},
            onTabActivate: { _ in },
            onTabClose: { _ in }
        )
    }
    .frame(width: 360)
}
