/**
 * Tab History Service
 * 
 * Records tab open/close events for browsing history.
 */

import { getCurrentUser } from './auth.js';
import { firestoreSet, firestoreList } from './firestore.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOCAL_STORAGE_KEY = 'tabHistory';
const MAX_LOCAL_ENTRIES = 200; // Keep last 200 entries locally
const DEFAULT_RETENTION_DAYS = 7;

// ============================================================================
// STATE
// ============================================================================

let historyCache = [];
let historyListeners = [];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize tab history from local storage
 */
export async function initTabHistory() {
  const stored = await chrome.storage.local.get([LOCAL_STORAGE_KEY]);
  historyCache = stored[LOCAL_STORAGE_KEY] || [];
  return historyCache;
}

/**
 * Get tab history
 * @param {number} days - Number of days to fetch (default: 7)
 * @returns {Array} List of tab history entries
 */
export function getTabHistory(days = DEFAULT_RETENTION_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return historyCache.filter(entry => 
    new Date(entry.timestamp) >= cutoffDate
  );
}

/**
 * Get tab history grouped by date
 * @param {number} days - Number of days to fetch
 * @returns {Object} History grouped by date string (YYYY-MM-DD)
 */
export function getTabHistoryByDate(days = DEFAULT_RETENTION_DAYS) {
  const history = getTabHistory(days);
  const grouped = {};
  
  for (const entry of history) {
    const date = entry.timestamp.split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(entry);
  }
  
  return grouped;
}

/**
 * Record a page visit
 * @param {Object} tab - Tab info
 */
export async function recordTabEvent(tab) {
  if (!tab || !tab.url) return;
  
  // Skip internal pages
  if (tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('brave://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('moz-extension://')) {
    return;
  }
  
  const entry = {
    id: generateId(),
    url: tab.url,
    title: tab.title || '',
    favIconUrl: tab.favIconUrl || '',
    timestamp: new Date().toISOString(),
  };
  
  // Add to cache at the beginning
  historyCache.unshift(entry);
  
  // Trim to max entries
  if (historyCache.length > MAX_LOCAL_ENTRIES) {
    historyCache = historyCache.slice(0, MAX_LOCAL_ENTRIES);
  }
  
  await saveToLocalStorage();
  notifyListeners();
}

/**
 * Clear tab history
 */
export async function clearTabHistory() {
  historyCache = [];
  await saveToLocalStorage();
  notifyListeners();
}

/**
 * Sync tab history with cloud
 */
export async function syncTabHistory() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    const cloudHistory = await firestoreList(`users/${user.uid}/tabHistory`);
    
    // Merge local and cloud
    const merged = mergeHistory(historyCache, cloudHistory);
    
    // Keep only recent entries
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_DAYS);
    
    historyCache = merged
      .filter(e => new Date(e.timestamp) >= cutoffDate)
      .slice(0, MAX_LOCAL_ENTRIES);
    
    await saveToLocalStorage();
    notifyListeners();
  } catch (error) {
    console.error('Failed to sync tab history:', error);
  }
}

/**
 * Subscribe to history changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function onTabHistoryChanged(callback) {
  historyListeners.push(callback);
  return () => {
    historyListeners = historyListeners.filter(cb => cb !== callback);
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

async function saveToLocalStorage() {
  await chrome.storage.local.set({ [LOCAL_STORAGE_KEY]: historyCache });
}

function notifyListeners() {
  historyListeners.forEach(cb => cb(historyCache));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function mergeHistory(local, cloud) {
  const merged = new Map();
  
  for (const entry of [...local, ...cloud]) {
    if (!merged.has(entry.id)) {
      merged.set(entry.id, entry);
    }
  }
  
  // Sort by timestamp descending
  return Array.from(merged.values()).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
