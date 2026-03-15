/**
 * Session History Service
 * 
 * Manages browsing session history with local-only storage.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const LOCAL_STORAGE_KEY = 'sessionHistory';
const MAX_LOCAL_SESSIONS = 50;
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
  
  const sessionId = generateId();
  const now = new Date();
  
  const session = {
    id: sessionId,
    date: now.toISOString().split('T')[0],
    tabs: tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned || false,
    })),
    tabCount: tabs.length,
    closedAt: now.toISOString(),
  };
  
  sessionsCache.unshift(session);
  
  if (sessionsCache.length > MAX_LOCAL_SESSIONS) {
    sessionsCache = sessionsCache.slice(0, MAX_LOCAL_SESSIONS);
  }
  
  await saveToLocalStorage();
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
    const currentTabs = await chrome.tabs.query({ currentWindow: true });
    const tabsToClose = currentTabs.filter(tab => !tab.pinned).map(tab => tab.id);
    
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
  }
  
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
  sessionsCache = sessionsCache.filter(s => s.id !== sessionId);
  await saveToLocalStorage();
  notifyListeners();
}

/**
 * Clean up old sessions beyond retention period
 * @param {number} retentionDays - Number of days to keep
 */
export async function cleanupOldSessions(retentionDays = DEFAULT_RETENTION_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  sessionsCache = sessionsCache.filter(s => 
    new Date(s.closedAt) >= cutoffDate
  );
  await saveToLocalStorage();
  notifyListeners();
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

async function saveToLocalStorage() {
  await chrome.storage.local.set({ [LOCAL_STORAGE_KEY]: sessionsCache });
}

function notifyListeners() {
  sessionListeners.forEach(cb => cb(sessionsCache));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
