//
//  BridgeMode.swift
//  TabDoggy
//
//  Handles running the app in "bridge mode" when launched by Chrome
//  In this mode, the app acts as a Native Messaging host without showing UI
//

import Foundation

/// Runs the app in bridge mode for Native Messaging
class BridgeMode {
    
    private let stdin = FileHandle.standardInput
    private let stdout = FileHandle.standardOutput
    private let sharedData = SharedDataService.shared
    
    private var isRunning = true
    private var currentBrowser: String = "unknown"
    
    // MARK: - Main Entry Point
    
    /// Run the bridge - this blocks until the connection is closed
    func run() {
        fputs("[TabDoggy Bridge] Starting bridge mode...\n", stderr)
        
        // Mark as connected immediately (browser will be identified later)
        sharedData.setConnected(true, browser: currentBrowser)
        
        // Start command checker on a separate thread
        let commandQueue = DispatchQueue(label: "com.tabdoggy.commands")
        commandQueue.async { [weak self] in
            self?.commandCheckLoop()
        }
        
        // Read messages from Chrome on main thread (blocking)
        readLoop()
        
        // Cleanup
        isRunning = false
        sharedData.setConnected(false, browser: currentBrowser)
        fputs("[TabDoggy Bridge] Bridge mode ended for \(currentBrowser)\n", stderr)
    }
    
    // MARK: - Message Reading Loop
    
    private func readLoop() {
        while isRunning {
            do {
                if let message = try readMessage() {
                    handleMessage(message)
                } else {
                    // EOF - connection closed
                    break
                }
            } catch {
                fputs("[TabDoggy Bridge] Error reading message: \(error)\n", stderr)
                break
            }
        }
    }
    
    private func readMessage() throws -> IncomingMessage? {
        // Read 4-byte length prefix
        let lengthData = stdin.readData(ofLength: 4)
        guard lengthData.count == 4 else {
            return nil // EOF
        }
        
        let length = lengthData.withUnsafeBytes { $0.load(as: UInt32.self).littleEndian }
        guard length > 0 && length <= 1_048_576 else {
            throw BridgeError.invalidLength(Int(length))
        }
        
        // Read JSON payload
        let jsonData = stdin.readData(ofLength: Int(length))
        guard jsonData.count == Int(length) else {
            throw BridgeError.incompleteMessage
        }
        
        return try JSONDecoder().decode(IncomingMessage.self, from: jsonData)
    }
    
    // MARK: - Message Handling
    
    private func handleMessage(_ message: IncomingMessage) {
        fputs("[TabDoggy Bridge] Received: \(message.type)\n", stderr)
        
        switch message.type {
        case "TABS_UPDATE":
            if let data = message.data {
                // Detect browser from message
                let browser = message.browser ?? data.browser ?? "unknown"
                if currentBrowser == "unknown" && browser != "unknown" {
                    currentBrowser = browser
                    fputs("[TabDoggy Bridge] Detected browser: \(browser)\n", stderr)
                }
                
                // Update connection status (heartbeat) - this keeps the connection "alive"
                sharedData.setConnected(true, browser: currentBrowser)
                
                // Write to browser-specific file for UI to read
                sharedData.writeTabData(data, browser: currentBrowser)
                fputs("[TabDoggy Bridge] Wrote \(data.tabs.count) tabs for \(currentBrowser)\n", stderr)
            }
            
        case "CONNECTION_STATUS":
            // Detect browser if sent with connection status
            if let browser = message.browser {
                currentBrowser = browser
            }
            sharedData.setConnected(true, browser: currentBrowser)
            fputs("[TabDoggy Bridge] Connection status updated for \(currentBrowser)\n", stderr)
            
        case "ERROR":
            fputs("[TabDoggy Bridge] Extension error: \(message.message ?? "unknown")\n", stderr)
            
        default:
            fputs("[TabDoggy Bridge] Unknown message type: \(message.type)\n", stderr)
        }
    }
    
    // MARK: - Command Checking Loop
    
    private func commandCheckLoop() {
        while isRunning {
            checkAndSendCommands()
            Thread.sleep(forTimeInterval: 0.3) // Check every 300ms
        }
    }
    
    private func checkAndSendCommands() {
        // Only read commands for this browser
        let commands = sharedData.readAndClearCommands(for: currentBrowser)
        
        for command in commands {
            sendCommand(command)
        }
    }
    
    private let writeLock = NSLock()
    
    private func sendCommand(_ command: TabCommand) {
        var message: [String: Any]
        
        switch command.type {
        case "CLOSE_TAB":
            guard let tabId = command.tabId else { return }
            message = ["type": "CLOSE_TAB", "tabId": tabId]
        case "CLOSE_TABS":
            guard let tabIds = command.tabIds else { return }
            message = ["type": "CLOSE_TABS", "tabIds": tabIds]
        case "ACTIVATE_TAB":
            guard let tabId = command.tabId else { return }
            message = ["type": "ACTIVATE_TAB", "tabId": tabId, "windowId": command.windowId ?? 0]
        case "OPEN_URL":
            guard let url = command.url else { return }
            message = ["type": "OPEN_URL", "url": url]
        default:
            return
        }
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message)
            
            // Write length prefix (thread-safe)
            writeLock.lock()
            defer { writeLock.unlock() }
            
            var length = UInt32(jsonData.count).littleEndian
            let lengthData = Data(bytes: &length, count: 4)
            
            stdout.write(lengthData)
            stdout.write(jsonData)
            
            fputs("[TabDoggy Bridge] Sent command: \(command.type)\n", stderr)
        } catch {
            fputs("[TabDoggy Bridge] Failed to send command: \(error)\n", stderr)
        }
    }
}

// MARK: - Errors

enum BridgeError: Error {
    case invalidLength(Int)
    case incompleteMessage
}
