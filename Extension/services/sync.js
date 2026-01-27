/**
 * Tab Sync Service
 * 
 * Handles synchronization of tabs between devices via Firestore.
 */

import { getCurrentUser, getIdToken } from './auth.js';
import { getDeviceId } from './device.js';
import { firestoreSet, firestoreDelete, firestoreList, firestoreBatch } from './firestore.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const SYNC_DEBOUNCE_MS = 500;
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

// ============================================================================
// STATE
// ============================================================================

let syncTimeout = null;
let pollInterval = null;
let remoteTabsCache = {};
let remoteTabsListeners = [];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start tab synchronization
 */
export async function startSync() {
  const user = getCurrentUser();
  if (!user) {
    console.log('Sync: No user logged in');
    return;
  }
  
  console.log('Sync: Starting sync for user', user.uid);
  
  // Initial sync
  await syncAllTabs();
  
  // Start polling for remote tabs
  startPolling();
}

/**
 * Stop tab synchronization
 */
export function stopSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
  
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  
  remoteTabsCache = {};
}

/**
 * Sync all current tabs to Firestore
 */
export async function syncAllTabs() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    const deviceId = await getDeviceId();
    const tabs = await chrome.tabs.query({});
    
    // Get existing synced tabs
    const existingTabs = await firestoreList(`users/${user.uid}/devices/${deviceId}/tabs`);
    const existingTabIds = new Set(existingTabs.map(t => t.id));
    const currentTabIds = new Set(tabs.map(t => t.id.toString()));
    
    // Prepare batch operations
    const operations = [];
    
    // Add/update current tabs
    for (const tab of tabs) {
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        continue; // Skip internal pages
      }
      
      operations.push({
        type: 'set',
        path: `users/${user.uid}/devices/${deviceId}/tabs/${tab.id}`,
        data: {
          url: tab.url,
          title: tab.title || '',
          favIconUrl: tab.favIconUrl || '',
          pinned: tab.pinned || false,
          lastAccessed: tab.lastAccessed ? new Date(tab.lastAccessed).toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
    
    // Delete tabs that no longer exist
    for (const existingId of existingTabIds) {
      if (!currentTabIds.has(existingId)) {
        operations.push({
          type: 'delete',
          path: `users/${user.uid}/devices/${deviceId}/tabs/${existingId}`,
        });
      }
    }
    
    // Execute batch if there are operations
    if (operations.length > 0) {
      // Split into smaller batches (Firestore limit is 500)
      const batchSize = 100;
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        await firestoreBatch(batch);
      }
    }
    
    console.log(`Sync: Synced ${tabs.length} tabs`);
  } catch (error) {
    console.error('Sync: Failed to sync tabs', error);
  }
}

/**
 * Sync a single tab (debounced)
 * @param {Object} tab - Tab object
 */
export function syncTab(tab) {
  // Debounce sync
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  
  syncTimeout = setTimeout(async () => {
    const user = getCurrentUser();
    if (!user) return;
    
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return; // Skip internal pages
    }
    
    try {
      const deviceId = await getDeviceId();
      
      await firestoreSet(`users/${user.uid}/devices/${deviceId}/tabs/${tab.id}`, {
        url: tab.url,
        title: tab.title || '',
        favIconUrl: tab.favIconUrl || '',
        pinned: tab.pinned || false,
        lastAccessed: tab.lastAccessed ? new Date(tab.lastAccessed).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`Sync: Updated tab ${tab.id}`);
    } catch (error) {
      console.error('Sync: Failed to sync tab', error);
    }
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Remove a tab from sync
 * @param {number} tabId - Tab ID
 */
export async function removeTab(tabId) {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    const deviceId = await getDeviceId();
    await firestoreDelete(`users/${user.uid}/devices/${deviceId}/tabs/${tabId}`);
    console.log(`Sync: Removed tab ${tabId}`);
  } catch (error) {
    console.error('Sync: Failed to remove tab', error);
  }
}

/**
 * Get tabs from other devices
 * @returns {Promise<Object>} Map of deviceId -> { device, tabs }
 */
export async function getRemoteTabs() {
  const user = getCurrentUser();
  if (!user) return {};
  
  try {
    const currentDeviceId = await getDeviceId();
    const devices = await firestoreList(`users/${user.uid}/devices`);
    
    const remoteTabs = {};
    
    for (const device of devices) {
      if (device.id === currentDeviceId) continue;
      
      const tabs = await firestoreList(`users/${user.uid}/devices/${device.id}/tabs`);
      
      remoteTabs[device.id] = {
        device: {
          id: device.id,
          name: device.name,
          browser: device.browser,
          os: device.os,
          lastSeen: device.lastSeen,
          isOnline: device.isOnline,
        },
        tabs: tabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          pinned: tab.pinned,
          lastAccessed: tab.lastAccessed,
        })),
      };
    }
    
    remoteTabsCache = remoteTabs;
    notifyRemoteTabsListeners(remoteTabs);
    
    return remoteTabs;
  } catch (error) {
    console.error('Sync: Failed to get remote tabs', error);
    return remoteTabsCache;
  }
}

/**
 * Get cached remote tabs (no network request)
 * @returns {Object} Cached remote tabs
 */
export function getCachedRemoteTabs() {
  return remoteTabsCache;
}

/**
 * Register a listener for remote tabs updates
 * @param {Function} callback - Called with remote tabs object
 * @returns {Function} Unsubscribe function
 */
export function onRemoteTabsChanged(callback) {
  remoteTabsListeners.push(callback);
  
  // Call immediately with cached data
  callback(remoteTabsCache);
  
  return () => {
    remoteTabsListeners = remoteTabsListeners.filter(cb => cb !== callback);
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Start polling for remote tabs
 */
function startPolling() {
  // Initial fetch
  getRemoteTabs();
  
  // Set up interval
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  
  pollInterval = setInterval(() => {
    getRemoteTabs();
  }, POLL_INTERVAL_MS);
}

/**
 * Notify all remote tabs listeners
 */
function notifyRemoteTabsListeners(remoteTabs) {
  remoteTabsListeners.forEach(callback => {
    try {
      callback(remoteTabs);
    } catch (error) {
      console.error('Remote tabs listener error:', error);
    }
  });
}
