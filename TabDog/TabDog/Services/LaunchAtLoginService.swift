//
//  LaunchAtLoginService.swift
//  TabDog
//
//  Service to manage Launch at Login functionality
//

import Foundation
import ServiceManagement

@Observable
final class LaunchAtLoginService {
    static let shared = LaunchAtLoginService()
    
    private let hasLaunchedBeforeKey = "hasLaunchedBefore"
    
    /// Whether the app is set to launch at login
    var isEnabled: Bool {
        get {
            if #available(macOS 13.0, *) {
                return SMAppService.mainApp.status == .enabled
            }
            return false
        }
        set {
            setLaunchAtLogin(newValue)
        }
    }
    
    private init() {
        // Enable launch at login by default on first launch
        enableOnFirstLaunchIfNeeded()
    }
    
    /// Toggle launch at login
    func toggle() {
        isEnabled.toggle()
    }
    
    /// Enable launch at login on first launch
    private func enableOnFirstLaunchIfNeeded() {
        let hasLaunchedBefore = UserDefaults.standard.bool(forKey: hasLaunchedBeforeKey)
        
        if !hasLaunchedBefore {
            UserDefaults.standard.set(true, forKey: hasLaunchedBeforeKey)
            
            // Enable launch at login by default
            if !isEnabled {
                setLaunchAtLogin(true)
                print("[TabDog] First launch - enabled launch at login by default")
            }
        }
    }
    
    /// Set launch at login state
    private func setLaunchAtLogin(_ enabled: Bool) {
        if #available(macOS 13.0, *) {
            do {
                if enabled {
                    try SMAppService.mainApp.register()
                    print("[TabDog] Registered for launch at login")
                } else {
                    try SMAppService.mainApp.unregister()
                    print("[TabDog] Unregistered from launch at login")
                }
            } catch {
                print("[TabDog] Failed to update launch at login: \(error)")
            }
        }
    }
}
