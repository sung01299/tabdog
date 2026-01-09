//
//  SharedDataService.swift
//  TabDoggy
//
//  Handles shared data between the Native Messaging bridge instance and the UI instance
//  Uses shared files for IPC between the two instances
//  Supports multiple browsers (Chrome, Brave, Edge, etc.)
//

import Foundation

/// Service for sharing data between app instances via file system
class SharedDataService {
    
    // MARK: - Singleton
    
    static let shared = SharedDataService()
    
    // MARK: - Constants
    
    private let sharedDirectory: URL = {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("TabDoggy", isDirectory: true)
    }()
    
    /// List of known browser types
    static let knownBrowsers = ["chrome", "brave", "edge", "opera", "vivaldi", "unknown"]
    
    // MARK: - File Paths
    
    /// Get tab data file for a specific browser
    private func tabDataFile(for browser: String) -> URL {
        sharedDirectory.appendingPathComponent("tabs-\(browser.lowercased()).json")
    }
    
    /// Get command file for a specific browser
    private func commandFile(for browser: String) -> URL {
        sharedDirectory.appendingPathComponent("commands-\(browser.lowercased()).json")
    }
    
    /// Legacy command file (for backward compatibility)
    private var legacyCommandFile: URL {
        sharedDirectory.appendingPathComponent("commands.json")
    }
    
    /// Get connection file for a specific browser
    private func connectionFile(for browser: String) -> URL {
        sharedDirectory.appendingPathComponent("connection-\(browser.lowercased()).txt")
    }
    
    // MARK: - Initialization
    
    private init() {
        // Create shared directory if needed
        try? FileManager.default.createDirectory(at: sharedDirectory, withIntermediateDirectories: true)
    }
    
    // MARK: - Tab Data (Bridge writes, UI reads)
    
    /// Write tab data for a specific browser (called by bridge instance)
    func writeTabData(_ data: TabsUpdateData, browser: String) {
        do {
            // Ensure the data has browser info
            var mutableData = data
            // Note: We can't mutate the browser field directly, so we store it in the filename
            
            let encoded = try JSONEncoder().encode(data)
            try encoded.write(to: tabDataFile(for: browser), options: .atomic)
        } catch {
            print("[TabDoggy] Failed to write tab data for \(browser): \(error)")
        }
    }
    
    /// Read tab data for a specific browser
    func readTabData(for browser: String) -> TabsUpdateData? {
        let file = tabDataFile(for: browser)
        guard FileManager.default.fileExists(atPath: file.path) else {
            return nil
        }
        
        do {
            let data = try Data(contentsOf: file)
            return try JSONDecoder().decode(TabsUpdateData.self, from: data)
        } catch {
            print("[TabDoggy] Failed to read tab data for \(browser): \(error)")
            return nil
        }
    }
    
    /// Read and merge tab data from all browsers (checks both connection status and data freshness)
    func readAllBrowserTabData() -> MergedTabData {
        var allTabs: [Tab] = []
        var browserData: [String: TabsUpdateData] = [:]
        var connectedBrowsers: [String] = []
        
        for browser in Self.knownBrowsers {
            // Check if this browser has recent data (within 15 seconds)
            let hasRecentData: Bool
            if let modDate = getTabDataModificationDate(for: browser) {
                hasRecentData = Date().timeIntervalSince(modDate) < 15
            } else {
                hasRecentData = false
            }
            
            // Also check explicit connection status
            let isConnected = isBrowserConnected(browser)
            
            // Read data if either connection is active or data is recent
            guard hasRecentData || isConnected else { continue }
            
            // Read tab data for this browser
            if let data = readTabData(for: browser) {
                connectedBrowsers.append(browser)
                browserData[browser] = data
                
                // Add browser info to each tab
                let tabsWithBrowser = data.tabs.map { tab -> Tab in
                    var t = tab
                    t.browser = browser
                    return t
                }
                allTabs.append(contentsOf: tabsWithBrowser)
            }
        }
        
        return MergedTabData(
            tabs: allTabs,
            browserData: browserData,
            connectedBrowsers: connectedBrowsers
        )
    }
    
    /// Get modification date of tab data file for a browser
    func getTabDataModificationDate(for browser: String) -> Date? {
        try? FileManager.default.attributesOfItem(atPath: tabDataFile(for: browser).path)[.modificationDate] as? Date
    }
    
    /// Get the latest modification date across all browsers
    func getLatestTabDataModificationDate() -> Date? {
        var latestDate: Date?
        
        for browser in Self.knownBrowsers {
            if let date = getTabDataModificationDate(for: browser) {
                if latestDate == nil || date > latestDate! {
                    latestDate = date
                }
            }
        }
        
        return latestDate
    }
    
    // MARK: - Legacy Support (for backward compatibility)
    
    /// Read tab data (legacy - reads merged data from all browsers)
    func readTabData() -> TabsUpdateData? {
        let merged = readAllBrowserTabData()
        guard !merged.tabs.isEmpty else { return nil }
        
        return TabsUpdateData(
            tabs: merged.tabs,
            tabCount: merged.tabs.count,
            browser: merged.connectedBrowsers.first
        )
    }
    
    /// Get modification date (legacy)
    func getTabDataModificationDate() -> Date? {
        getLatestTabDataModificationDate()
    }
    
    // MARK: - Commands (UI writes, Bridge reads)
    
    /// Write a command to the appropriate browser's command file
    func writeCommand(_ command: TabCommand) {
        // Determine which browser to send the command to
        let browser = command.browser ?? "unknown"
        let file = commandFile(for: browser)
        
        do {
            // Read existing commands for this browser
            var commands = readCommands(for: browser)
            commands.append(command)
            
            let encoded = try JSONEncoder().encode(commands)
            try encoded.write(to: file, options: .atomic)
            print("[TabDoggy] Wrote command \(command.type) for \(browser)")
        } catch {
            print("[TabDoggy] Failed to write command: \(error)")
        }
    }
    
    /// Read and clear commands for a specific browser (called by bridge instance)
    func readAndClearCommands(for browser: String) -> [TabCommand] {
        let file = commandFile(for: browser)
        
        guard FileManager.default.fileExists(atPath: file.path) else {
            return []
        }
        
        let commands = readCommands(for: browser)
        
        // Clear the file
        try? FileManager.default.removeItem(at: file)
        
        return commands
    }
    
    /// Legacy: Read and clear all commands (for backward compatibility)
    func readAndClearCommands() -> [TabCommand] {
        // Read from all known browsers
        var allCommands: [TabCommand] = []
        for browser in Self.knownBrowsers {
            allCommands.append(contentsOf: readAndClearCommands(for: browser))
        }
        return allCommands
    }
    
    private func readCommands(for browser: String) -> [TabCommand] {
        let file = commandFile(for: browser)
        
        guard FileManager.default.fileExists(atPath: file.path) else {
            return []
        }
        
        do {
            let data = try Data(contentsOf: file)
            return try JSONDecoder().decode([TabCommand].self, from: data)
        } catch {
            return []
        }
    }
    
    // MARK: - Connection Status
    
    /// Mark browser as connected/disconnected
    func setConnected(_ connected: Bool, browser: String = "unknown") {
        let content = connected ? "connected" : "disconnected"
        try? content.write(to: connectionFile(for: browser), atomically: true, encoding: .utf8)
    }
    
    /// Check if a specific browser is connected
    func isBrowserConnected(_ browser: String) -> Bool {
        let file = connectionFile(for: browser)
        guard let content = try? String(contentsOf: file, encoding: .utf8) else {
            return false
        }
        
        // Also check if the file was updated recently (within 10 seconds)
        if let modDate = try? FileManager.default.attributesOfItem(atPath: file.path)[.modificationDate] as? Date {
            let age = Date().timeIntervalSince(modDate)
            if age > 10 {
                return false
            }
        }
        
        return content == "connected"
    }
    
    /// Check if any browser is connected (legacy)
    func isConnected() -> Bool {
        for browser in Self.knownBrowsers {
            if isBrowserConnected(browser) {
                return true
            }
        }
        return false
    }
    
    /// Get list of currently connected browsers
    func getConnectedBrowsers() -> [String] {
        Self.knownBrowsers.filter { isBrowserConnected($0) }
    }
}

// MARK: - Merged Tab Data

/// Container for merged tab data from multiple browsers
struct MergedTabData {
    let tabs: [Tab]
    let browserData: [String: TabsUpdateData]
    let connectedBrowsers: [String]
    
    var totalTabCount: Int { tabs.count }
    
    /// Get display names for connected browsers
    var connectedBrowserNames: [String] {
        connectedBrowsers.map { browser in
            switch browser.lowercased() {
            case "chrome": return "Chrome"
            case "brave": return "Brave"
            case "edge": return "Edge"
            case "opera": return "Opera"
            case "vivaldi": return "Vivaldi"
            default: return browser.capitalized
            }
        }
    }
}

// MARK: - Command Types

struct TabCommand: Codable {
    let type: String
    let tabId: Int?
    let tabIds: [Int]?
    let windowId: Int?
    let url: String?
    let browser: String?  // Which browser to send command to
    let timestamp: Date
    
    static func close(tabId: Int, browser: String? = nil) -> TabCommand {
        TabCommand(type: "CLOSE_TAB", tabId: tabId, tabIds: nil, windowId: nil, url: nil, browser: browser, timestamp: Date())
    }
    
    static func closeTabs(tabIds: [Int], browser: String? = nil) -> TabCommand {
        TabCommand(type: "CLOSE_TABS", tabId: nil, tabIds: tabIds, windowId: nil, url: nil, browser: browser, timestamp: Date())
    }
    
    static func activate(tabId: Int, windowId: Int, browser: String? = nil) -> TabCommand {
        TabCommand(type: "ACTIVATE_TAB", tabId: tabId, tabIds: nil, windowId: windowId, url: nil, browser: browser, timestamp: Date())
    }

    static func openUrl(_ url: String, browser: String? = nil) -> TabCommand {
        TabCommand(type: "OPEN_URL", tabId: nil, tabIds: nil, windowId: nil, url: url, browser: browser, timestamp: Date())
    }
}
