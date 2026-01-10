//
//  Message.swift
//  TabDog
//
//  Message types for Native Messaging protocol between Chrome Extension and macOS App
//

import Foundation

// MARK: - Incoming Messages (Extension → App)

/// Wrapper for all incoming messages from the Chrome extension
struct IncomingMessage: Codable {
    let type: String
    let timestamp: Int64?
    let browser: String?  // Browser type: "chrome", "brave", "edge", etc.
    let data: TabsUpdateData?
    let status: String?
    let extensionVersion: String?
    let code: String?
    let message: String?
}

/// Tab update payload data
struct TabsUpdateData: Codable {
    let tabs: [Tab]
    let tabCount: Int?
    let browser: String?  // Browser type for this data
    
    /// Browser display name
    var browserDisplayName: String {
        switch browser?.lowercased() {
        case "chrome": return "Chrome"
        case "brave": return "Brave"
        case "edge": return "Edge"
        case "opera": return "Opera"
        case "vivaldi": return "Vivaldi"
        default: return browser?.capitalized ?? "Browser"
        }
    }
    
    /// Browser icon (SF Symbol)
    var browserIcon: String {
        // All Chromium-based browsers can use a generic icon
        return "globe"
    }
}

// MARK: - Outgoing Messages (App → Extension)

/// Base protocol for all outgoing messages
protocol OutgoingMessageProtocol: Encodable {
    var type: String { get }
}

/// Close a specific tab
struct CloseTabMessage: OutgoingMessageProtocol {
    let type = "CLOSE_TAB"
    let tabId: Int
}

/// Close multiple tabs
struct CloseTabsMessage: OutgoingMessageProtocol {
    let type = "CLOSE_TABS"
    let tabIds: [Int]
}

/// Activate (focus) a specific tab
struct ActivateTabMessage: OutgoingMessageProtocol {
    let type = "ACTIVATE_TAB"
    let tabId: Int
    let windowId: Int
}

/// Request an immediate data update
struct RequestUpdateMessage: OutgoingMessageProtocol {
    let type = "REQUEST_UPDATE"
}

// MARK: - Message Type Constants

enum IncomingMessageType: String {
    case tabsUpdate = "TABS_UPDATE"
    case connectionStatus = "CONNECTION_STATUS"
    case error = "ERROR"
}

// MARK: - Errors

enum MessageError: Error, LocalizedError {
    case invalidMessageFormat
    case unknownMessageType(String)
    case decodingFailed(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidMessageFormat:
            return "Invalid message format received"
        case .unknownMessageType(let type):
            return "Unknown message type: \(type)"
        case .decodingFailed(let error):
            return "Failed to decode message: \(error.localizedDescription)"
        }
    }
}
