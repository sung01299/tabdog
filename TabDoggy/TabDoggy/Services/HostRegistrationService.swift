//
//  HostRegistrationService.swift
//  TabDoggy
//
//  Handles automatic registration of Native Messaging Host manifest for Chrome
//

import Foundation

/// Service for registering the Native Messaging Host with Chrome
struct HostRegistrationService {
    
    // MARK: - Constants
    
    static let hostName = "com.tabdoggy.host"
    
    // MARK: - Production Distribution (TODO: replace with real values before release)
    
    /// Production extension ID (fixed once the extension is published).
    /// Replace this constant with your real Chrome Web Store extension ID.
    static let productionExtensionId: String = "icijhodoemiiifknenghopjfhlmbndcg"
    
    /// Chrome Web Store URL for the extension (used in Settings UX).
    static let extensionStoreURL: URL? = URL(string: "https://chromewebstore.google.com/detail/icijhodoemiiifknenghopjfhlmbndcg")
    
    // MARK: - Supported Browsers
    
    enum Browser: String, CaseIterable, Identifiable, Hashable {
        case chrome
        case brave
        case edge
        case vivaldi
        case opera
        
        var id: String { rawValue }
        
        var displayName: String {
            switch self {
            case .chrome: return "Chrome"
            case .brave: return "Brave"
            case .edge: return "Edge"
            case .vivaldi: return "Vivaldi"
            case .opera: return "Opera"
            }
        }
    }
    
    /// Path where Chrome looks for Native Messaging Host manifests
    static func hostManifestDirectory(for browser: Browser) -> URL {
        let base = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support")
        
        switch browser {
        case .chrome:
            return base.appendingPathComponent("Google/Chrome/NativeMessagingHosts")
        case .brave:
            return base.appendingPathComponent("BraveSoftware/Brave-Browser/NativeMessagingHosts")
        case .edge:
            return base.appendingPathComponent("Microsoft Edge/NativeMessagingHosts")
        case .vivaldi:
            return base.appendingPathComponent("Vivaldi/NativeMessagingHosts")
        case .opera:
            // Opera path can vary slightly across versions; this is the common one on macOS.
            return base.appendingPathComponent("com.operasoftware.Opera/NativeMessagingHosts")
        }
    }
    
    /// Full path to the host manifest file
    static func hostManifestPath(for browser: Browser) -> URL {
        hostManifestDirectory(for: browser).appendingPathComponent("\(hostName).json")
    }
    
    /// Legacy: Chrome manifest path (used by some debug UI)
    static var hostManifestPath: URL { hostManifestPath(for: .chrome) }
    
    // MARK: - Registration
    
    /// Check if the host manifest is already registered
    static func isRegistered() -> Bool {
        registrationStatus().values.contains(true)
    }
    
    static func registrationStatus() -> [Browser: Bool] {
        var result: [Browser: Bool] = [:]
        for browser in Browser.allCases {
            result[browser] = FileManager.default.fileExists(atPath: hostManifestPath(for: browser).path)
        }
        return result
    }
    
    /// Register the Native Messaging Host with Chrome
    /// - Parameter extensionId: The Chrome extension ID to allow
    /// - Throws: Error if registration fails
    static func register(extensionId: String) throws {
        try register(extensionId: extensionId, browsers: Browser.allCases)
    }
    
    static func registerProduction() throws {
        try register(extensionId: productionExtensionId, browsers: Browser.allCases)
    }
    
    static func register(extensionId: String, browsers: [Browser]) throws {
        // Get the path to the current app executable
        guard let appPath = Bundle.main.executablePath else {
            throw HostRegistrationError.executableNotFound
        }
        
        // Create the host manifest
        let manifest: [String: Any] = [
            "name": hostName,
            "description": "TabDoggy Native Messaging Host - Bridge Chrome tabs to macOS menu bar",
            "path": appPath,
            "type": "stdio",
            "allowed_origins": [
                "chrome-extension://\(extensionId)/"
            ]
        ]
        
        let data = try JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted)
        
        for browser in browsers {
            let dir = hostManifestDirectory(for: browser)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: nil)
            try data.write(to: hostManifestPath(for: browser))
            print("[TabDoggy] Host manifest registered for \(browser.displayName) at: \(hostManifestPath(for: browser).path)")
        }
    }
    
    /// Unregister the Native Messaging Host
    static func unregister() throws {
        for browser in Browser.allCases {
            let path = hostManifestPath(for: browser)
            if FileManager.default.fileExists(atPath: path.path) {
                try? FileManager.default.removeItem(at: path)
            }
        }
        print("[TabDoggy] Host manifests removed")
    }
    
    /// Get the current registered extension ID (if any)
    static func getRegisteredExtensionId() -> String? {
        // Prefer Chrome manifest if present; otherwise return first found.
        let paths = Browser.allCases.map { hostManifestPath(for: $0) }
        guard let path = paths.first(where: { FileManager.default.fileExists(atPath: $0.path) }),
              let data = try? Data(contentsOf: path),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let origins = json["allowed_origins"] as? [String],
              let firstOrigin = origins.first else {
            return nil
        }
        
        // Extract extension ID from "chrome-extension://EXTENSION_ID/"
        let prefix = "chrome-extension://"
        let suffix = "/"
        if firstOrigin.hasPrefix(prefix) && firstOrigin.hasSuffix(suffix) {
            let startIndex = firstOrigin.index(firstOrigin.startIndex, offsetBy: prefix.count)
            let endIndex = firstOrigin.index(firstOrigin.endIndex, offsetBy: -suffix.count)
            return String(firstOrigin[startIndex..<endIndex])
        }
        
        return nil
    }
}

// MARK: - Errors

enum HostRegistrationError: Error, LocalizedError {
    case executableNotFound
    case directoryCreationFailed
    case manifestWriteFailed
    
    var errorDescription: String? {
        switch self {
        case .executableNotFound:
            return "Could not find app executable path"
        case .directoryCreationFailed:
            return "Failed to create Native Messaging Hosts directory"
        case .manifestWriteFailed:
            return "Failed to write host manifest file"
        }
    }
}

