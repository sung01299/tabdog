//
//  ProcessInfoService.swift
//  TabDog
//
//  Service for getting CPU and memory usage information for processes
//

import Foundation
import Darwin

/// Service for getting process resource usage
class ProcessInfoService {
    
    // MARK: - Singleton
    
    static let shared = ProcessInfoService()
    
    private init() {}
    
    // MARK: - Process Info Cache
    
    private struct CacheEntry {
        let info: ProcessResourceInfo
        let timestamp: Date
    }
    
    /// Cache of process info to avoid frequent lookups
    private var processInfoCache: [Int: CacheEntry] = [:]
    
    /// Refresh interval (ps invocation is relatively expensive; keep it low-frequency)
    private let cacheValiditySeconds: TimeInterval = 10.0  // Refresh every 10 seconds
    
    // MARK: - Public Methods
    
    /// Get resource info for a process by PID
    func getProcessInfo(pid: Int) -> ProcessResourceInfo? {
        let now = Date()
        if let entry = processInfoCache[pid], now.timeIntervalSince(entry.timestamp) < cacheValiditySeconds {
            return entry.info
        }
        guard let info = fetchProcessInfo(pid: pid) else {
            return nil
        }
        processInfoCache[pid] = CacheEntry(info: info, timestamp: now)
        return info
    }
    
    /// Refresh all process info
    func refreshAllProcessInfo(pids: [Int]) {
        let now = Date()
        for pid in pids {
            if let info = fetchProcessInfo(pid: pid) {
                processInfoCache[pid] = CacheEntry(info: info, timestamp: now)
            }
        }
    }
    
    // MARK: - Private Methods
    
    /// Fetch process info from the system
    private func fetchProcessInfo(pid: Int) -> ProcessResourceInfo? {
        // ps-based approach (lower-frequency, stable to parse, matches system tools better)
        // %cpu and rss are provided by ps.
        return fetchProcessInfoViaPS(pid: pid)
    }
    
    private func fetchProcessInfoViaPS(pid: Int) -> ProcessResourceInfo? {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/ps")
        task.arguments = ["-p", "\(pid)", "-o", "%cpu=", "-o", "rss="]
        
        let out = Pipe()
        task.standardOutput = out
        task.standardError = Pipe()
        
        do {
            try task.run()
        } catch {
            return nil
        }
        
        task.waitUntilExit()
        guard task.terminationStatus == 0 else { return nil }
        
        let data = out.fileHandleForReading.readDataToEndOfFile()
        guard let raw = String(data: data, encoding: .utf8) else { return nil }
        
        // Expected: "<cpu> <rss>\n" with variable whitespace
        let parts = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: { $0 == " " || $0 == "\t" })
            .map(String.init)
        
        guard parts.count >= 2 else { return nil }
        
        let cpuString = parts[0].replacingOccurrences(of: ",", with: ".")
        let rssString = parts[1]
        
        guard let cpu = Double(cpuString), let rssKB = Double(rssString) else { return nil }
        let memMB = rssKB / 1024.0
        
        return ProcessResourceInfo(pid: pid, memoryMB: memMB, cpuPercent: max(0.0, cpu))
    }
}

// MARK: - Process Resource Info Model

struct ProcessResourceInfo {
    let pid: Int
    let memoryMB: Double
    let cpuPercent: Double
    
    /// Formatted memory string (e.g., "128.5 MB")
    var formattedMemory: String {
        if memoryMB < 1 {
            return String(format: "%.0f KB", memoryMB * 1024)
        } else if memoryMB < 1000 {
            return String(format: "%.0f MB", memoryMB)
        } else {
            return String(format: "%.1f GB", memoryMB / 1024)
        }
    }
    
    /// Formatted CPU string (e.g., "5.2%")
    var formattedCPU: String {
        if cpuPercent < 0.1 {
            return "< 0.1%"
        } else if cpuPercent < 10 {
            return String(format: "%.1f%%", cpuPercent)
        } else {
            return String(format: "%.0f%%", cpuPercent)
        }
    }
    
    /// Memory color based on usage (green -> yellow -> red)
    var memoryColor: String {
        if memoryMB < 200 {
            return "green"
        } else if memoryMB < 500 {
            return "yellow"
        } else {
            return "red"
        }
    }
    
    /// CPU color based on usage
    var cpuColor: String {
        if cpuPercent < 10 {
            return "green"
        } else if cpuPercent < 50 {
            return "yellow"
        } else {
            return "red"
        }
    }
}

