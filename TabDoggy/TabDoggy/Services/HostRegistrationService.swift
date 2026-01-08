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
    
    /// Path where Chrome looks for Native Messaging Host manifests
    static var hostManifestDirectory: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Google/Chrome/NativeMessagingHosts")
    }
    
    /// Full path to the host manifest file
    static var hostManifestPath: URL {
        hostManifestDirectory.appendingPathComponent("\(hostName).json")
    }
    
    // MARK: - Registration
    
    /// Check if the host manifest is already registered
    static func isRegistered() -> Bool {
        FileManager.default.fileExists(atPath: hostManifestPath.path)
    }
    
    /// Register the Native Messaging Host with Chrome
    /// - Parameter extensionId: The Chrome extension ID to allow
    /// - Throws: Error if registration fails
    static func register(extensionId: String) throws {
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
        
        // Create directory if needed
        try FileManager.default.createDirectory(
            at: hostManifestDirectory,
            withIntermediateDirectories: true,
            attributes: nil
        )
        
        // Write manifest file
        let data = try JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted)
        try data.write(to: hostManifestPath)
        
        print("[TabDoggy] Host manifest registered at: \(hostManifestPath.path)")
    }
    
    /// Unregister the Native Messaging Host
    static func unregister() throws {
        guard isRegistered() else { return }
        try FileManager.default.removeItem(at: hostManifestPath)
        print("[TabDoggy] Host manifest removed")
    }
    
    /// Get the current registered extension ID (if any)
    static func getRegisteredExtensionId() -> String? {
        guard isRegistered(),
              let data = try? Data(contentsOf: hostManifestPath),
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

