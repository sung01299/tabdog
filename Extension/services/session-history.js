/**
 * Session History Service
 * 
 * Manages browsing session history with automatic saving and cloud sync.
 */

import { getCurrentUser } from './auth.js';
import { firestoreSet, firestoreList, firestoreDelete } from './firestore.js';
import { getDeviceId } from './device.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOCAL_STORAGE_KEY = 'sessionHistory';
const MAX_LOCAL_SESSIONS = 50; // Keep last 50 sessions locally
const DEFAULT_RETENTION_DAYS = 30;

// ============================================================================
// STATE
// ============================================================================

let sessionsCache = [];
let sessionListeners = [];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize sessions from local storage
 */
export async function initSessions() {
  const stored = await chrome.storage.local.get([LOCAL_STORAGE_KEY]);
  sessionsCache = stored[LOCAL_STORAGE_KEY] || [];
  return sessionsCache;
}

/**
 * Get all sessions
 * @param {number} days - Number of days to fetch (default: 30)
 * @returns {Array} List of sessions
 */
export function getSessions(days = DEFAULT_RETENTION_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return sessionsCache.filter(session => 
    new Date(session.closedAt) >= cutoffDate
  );
}

/**
 * Get sessions grouped by date
 * @param {number} days - Number of days to fetch
 * @returns {Object} Sessions grouped by date string (YYYY-MM-DD)
 */
export function getSessionsByDate(days = DEFAULT_RETENTION_DAYS) {
  const sessions = getSessions(days);
  const grouped = {};
  
  for (const session of sessions) {
    const date = session.date || session.closedAt.split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(session);
  }
  
  return grouped;
}

/**
 * Save current session (called when browser closes or periodically)
 * @param {Array} tabs - Current tabs to save
 * @returns {Promise<Object>} Saved session
 */
export async function saveSession(tabs) {
  if (!tabs || tabs.length === 0) return null;
  
  const user = getCurrentUser();
  const deviceId = await getDeviceId();
  const sessionId = generateId();
  const now = new Date();
  
  const session = {
    id: sessionId,
    date: now.toISOString().split('T')[0], // YYYY-MM-DD
    deviceId,
    tabs: tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned || false,
    })),
    tabCount: tabs.length,
    closedAt: now.toISOString(),
  };
  
  // Add to local cache
  sessionsCache.unshift(session);
  
  // Trim to max local sessions
  if (sessionsCache.length > MAX_LOCAL_SESSIONS) {
    sessionsCache = sessionsCache.slice(0, MAX_LOCAL_SESSIONS);
  }
  
  await saveToLocalStorage();
  
  // Save to cloud if logged in
  if (user) {
    try {
      await firestoreSet(`users/${user.uid}/sessions/${sessionId}`, session);
    } catch (error) {
      console.error('Failed to save session to cloud:', error);
    }
  }
  
  notifyListeners();
  return session;
}

/**
 * Restore a session (open its tabs)
 * @param {string} sessionId - Session ID
 * @param {string} mode - 'replace' or 'add'
 */
export async function restoreSession(sessionId, mode = 'add') {
  const session = sessionsCache.find(s => s.id === sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (mode === 'replace') {
    // Close all current tabs except pinned
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const tabsToClose = currentTabs.filter(tab => !tab.pinned).map(tab => tab.id);
    
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
  }
  
  // Open session tabs
  for (const tab of session.tabs) {
    await chrome.tabs.create({
      url: tab.url,
      pinned: tab.pinned,
      active: false,
    });
  }
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID
 */
export async function deleteSession(sessionId) {
  const user = getCurrentUser();
  
  sessionsCache = sessionsCache.filter(s => s.id !== sessionId);
  await saveToLocalStorage();
  
  // Delete from cloud if logged in
  if (user) {
    try {
      await firestoreDelete(`users/${user.uid}/sessions/${sessionId}`);
    } catch (error) {
      console.error('Failed to delete session from cloud:', error);
    }
  }
  
  notifyListeners();
}

/**
 * Clean up old sessions beyond retention period
 * @param {number} retentionDays - Number of days to keep
 */
export async function cleanupOldSessions(retentionDays = DEFAULT_RETENTION_DAYS) {
  const user = getCurrentUser();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const oldSessions = sessionsCache.filter(s => 
    new Date(s.closedAt) < cutoffDate
  );
  
  // Remove from local cache
  sessionsCache = sessionsCache.filter(s => 
    new Date(s.closedAt) >= cutoffDate
  );
  await saveToLocalStorage();
  
  // Delete from cloud
  if (user) {
    for (const session of oldSessions) {
      try {
        await firestoreDelete(`users/${user.uid}/sessions/${session.id}`);
      } catch (error) {
        console.error('Failed to delete old session from cloud:', error);
      }
    }
  }
  
  notifyListeners();
}

/**
 * Sync sessions with cloud
 */
export async function syncSessions() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    // Fetch recent sessions from cloud
    const cloudSessions = await firestoreList(`users/${user.uid}/sessions`);
    
    // Merge local and cloud
    const merged = mergeSessions(sessionsCache, cloudSessions);
    
    // Keep only recent sessions
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DEFAULT_RETENTION_DAYS);
    
    sessionsCache = merged
      .filter(s => new Date(s.closedAt) >= cutoffDate)
      .slice(0, MAX_LOCAL_SESSIONS);
    
    await saveToLocalStorage();
    notifyListeners();
  } catch (error) {
    console.error('Failed to sync sessions:', error);
  }
}

/**
 * Subscribe to session changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function onSessionsChanged(callback) {
  sessionListeners.push(callback);
  return () => {
    sessionListeners = sessionListeners.filter(cb => cb !== callback);
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Save sessions to local storage
 */
async function saveToLocalStorage() {
  await chrome.storage.local.set({ [LOCAL_STORAGE_KEY]: sessionsCache });
}

/**
 * Notify all listeners of session changes
 */
function notifyListeners() {
  sessionListeners.forEach(cb => cb(sessionsCache));
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Merge local and cloud sessions
 * @param {Array} local - Local sessions
 * @param {Array} cloud - Cloud sessions
 * @returns {Array} Merged sessions
 */
function mergeSessions(local, cloud) {
  const merged = new Map();
  
  // Add all sessions by ID
  for (const session of [...local, ...cloud]) {
    if (!merged.has(session.id)) {
      merged.set(session.id, session);
    }
  }
  
  // Sort by closedAt descending
  return Array.from(merged.values()).sort((a, b) => 
    new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
  );
}
