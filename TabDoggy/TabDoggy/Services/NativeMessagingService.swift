//
//  NativeMessagingService.swift
//  TabDoggy
//
//  Handles Native Messaging communication with Chrome Extension via stdin/stdout
//

import Foundation

/// Service for bidirectional communication with Chrome Extension via Native Messaging
actor NativeMessagingService {
    private let stdin = FileHandle.standardInput
    private let stdout = FileHandle.standardOutput
    
    private var isReading = false
    
    // MARK: - Reading Messages
    
    /// Start reading messages from stdin as an async stream
    func startReading() -> AsyncThrowingStream<IncomingMessage, Error> {
        AsyncThrowingStream { continuation in
            Task {
                self.isReading = true
                
                while self.isReading {
                    do {
                        if let message = try await self.readMessage() {
                            continuation.yield(message)
                        } else {
                            // Connection closed
                            continuation.finish()
                            break
                        }
                    } catch {
                        continuation.finish(throwing: error)
                        break
                    }
                }
            }
        }
    }
    
    /// Stop reading messages
    func stopReading() {
        isReading = false
    }
    
    /// Read a single message from stdin
    private func readMessage() async throws -> IncomingMessage? {
        // 1. Read 4-byte length prefix (little-endian UInt32)
        let lengthData = stdin.readData(ofLength: 4)
        
        guard lengthData.count == 4 else {
            // Connection closed or EOF
            return nil
        }
        
        let length = lengthData.withUnsafeBytes { buffer in
            buffer.load(as: UInt32.self).littleEndian
        }
        
        // Safety check for message size (max 1MB as per Chrome's limit)
        guard length > 0 && length <= 1_048_576 else {
            throw NativeMessagingError.invalidMessageLength(Int(length))
        }
        
        // 2. Read JSON payload
        let jsonData = stdin.readData(ofLength: Int(length))
        
        guard jsonData.count == Int(length) else {
            throw NativeMessagingError.incompleteMessage
        }
        
        // 3. Decode JSON to IncomingMessage
        do {
            let message = try JSONDecoder().decode(IncomingMessage.self, from: jsonData)
            return message
        } catch {
            throw NativeMessagingError.decodingFailed(error)
        }
    }
    
    // MARK: - Writing Messages
    
    /// Send a message to the Chrome extension via stdout
    func sendMessage<T: OutgoingMessageProtocol>(_ message: T) throws {
        // 1. Encode message to JSON
        let jsonData = try JSONEncoder().encode(message)
        
        // 2. Create 4-byte length prefix (little-endian)
        var length = UInt32(jsonData.count).littleEndian
        let lengthData = Data(bytes: &length, count: 4)
        
        // 3. Write length prefix + JSON data
        stdout.write(lengthData)
        stdout.write(jsonData)
    }
    
    /// Send a close tab command
    func closeTab(tabId: Int) throws {
        try sendMessage(CloseTabMessage(tabId: tabId))
    }
    
    /// Send an activate tab command
    func activateTab(tabId: Int, windowId: Int) throws {
        try sendMessage(ActivateTabMessage(tabId: tabId, windowId: windowId))
    }
    
    /// Request an immediate update from the extension
    func requestUpdate() throws {
        try sendMessage(RequestUpdateMessage())
    }
}

// MARK: - Errors

enum NativeMessagingError: Error, LocalizedError {
    case invalidMessageLength(Int)
    case incompleteMessage
    case decodingFailed(Error)
    case encodingFailed(Error)
    case connectionClosed
    
    var errorDescription: String? {
        switch self {
        case .invalidMessageLength(let length):
            return "Invalid message length: \(length)"
        case .incompleteMessage:
            return "Received incomplete message"
        case .decodingFailed(let error):
            return "Failed to decode message: \(error.localizedDescription)"
        case .encodingFailed(let error):
            return "Failed to encode message: \(error.localizedDescription)"
        case .connectionClosed:
            return "Native messaging connection closed"
        }
    }
}

