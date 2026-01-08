//
//  ProcessInfoService.swift
//  TabDoggy
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
    
    /// Cache of process info to avoid frequent lookups
    private var processInfoCache: [Int: ProcessResourceInfo] = [:]
    private var lastCacheUpdate: Date?
    private let cacheValiditySeconds: TimeInterval = 2.0  // Refresh every 2 seconds
    
    // MARK: - Public Methods
    
    /// Get resource info for a process by PID
    func getProcessInfo(pid: Int) -> ProcessResourceInfo? {
        // Return cached info if still valid
        if let lastUpdate = lastCacheUpdate,
           Date().timeIntervalSince(lastUpdate) < cacheValiditySeconds,
           let cached = processInfoCache[pid] {
            return cached
        }
        
        // Get fresh info
        return fetchProcessInfo(pid: pid)
    }
    
    /// Refresh all process info
    func refreshAllProcessInfo(pids: [Int]) {
        processInfoCache.removeAll()
        
        for pid in pids {
            if let info = fetchProcessInfo(pid: pid) {
                processInfoCache[pid] = info
            }
        }
        
        lastCacheUpdate = Date()
    }
    
    // MARK: - Private Methods
    
    /// Fetch process info from the system
    private func fetchProcessInfo(pid: Int) -> ProcessResourceInfo? {
        // Get memory info using proc_pid_rusage
        var rusage = rusage_info_v3()
        
        let result = withUnsafeMutablePointer(to: &rusage) { ptr -> Int32 in
            let opaquePtr = UnsafeMutableRawPointer(ptr)
            return proc_pid_rusage(Int32(pid), RUSAGE_INFO_V3, opaquePtr.assumingMemoryBound(to: rusage_info_t?.self))
        }
        
        guard result == 0 else {
            return nil
        }
        
        // Convert memory from bytes to MB
        let memoryMB = Double(rusage.ri_phys_footprint) / (1024 * 1024)
        
        // Get CPU usage using task_info
        let cpuUsage = getCPUUsage(pid: pid)
        
        let info = ProcessResourceInfo(
            pid: pid,
            memoryMB: memoryMB,
            cpuPercent: cpuUsage
        )
        
        processInfoCache[pid] = info
        
        return info
    }
    
    /// Get CPU usage percentage for a process
    private func getCPUUsage(pid: Int) -> Double {
        // Use sysctl to get process info
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, Int32(pid)]
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.size
        
        let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
        
        guard result == 0 else {
            return 0.0
        }
        
        // CPU percentage from kinfo_proc is in p_pctcpu (0-100 scaled)
        // Note: This is a rough estimate - for more accurate CPU tracking,
        // we'd need to sample over time
        let cpuUsage = Double(info.kp_proc.p_pctcpu) / Double(FSCALE) * 100.0
        
        return cpuUsage
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

