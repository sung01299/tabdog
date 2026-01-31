/**
 * TabDog - Chrome Extension Background Service Worker
 * 
 * This service worker tracks tab creation times to enable
 * duration display in the popup UI.
 * 
 * Also handles cloud sync with Firebase when user is logged in.
 */

import { initAuth, onAuthStateChanged, getCurrentUser, signInWithGoogle, signOut } from './services/auth.js';
import { registerDevice, updateDeviceStatus } from './services/device.js';
import { startSync, stopSync, syncAllTabs, syncTab, removeTab } from './services/sync.js';
import { saveSession } from './services/session-history.js';
import { syncWorkspaces } from './services/workspace.js';

const TAB_TIMES_KEY = "tabCreationTimes";
const SYNC_ALARM_NAME = "tabdog-sync";
const SESSION_ALARM_NAME = "tabdog-session";
const SYNC_INTERVAL_MINUTES = 1; // 1 minute - more frequent for better online status
const SESSION_INTERVAL_SECONDS = 3600; // 1 hour

// In-memory cache of tab creation times (tabId -> timestamp)
let tabCreationTimes = {};

// In-memory cache of tab info for history (tabId -> tab info)
const tabInfoCache = new Map();

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the extension on startup
 */
async function initialize() {
  console.log("[TabDog] Initializing extension...");
  
  // Load saved tab creation times
  await loadTabCreationTimes();
  
  // Record times for existing tabs that we don't have
  await recordExistingTabs();
  
  // Update badge with tab count
  await updateBadge();
  
  // Initialize authentication
  await initAuth();
  
  // Set up auth state listener for sync
  onAuthStateChanged(handleAuthStateChanged);
  
  console.log("[TabDog] Extension initialized");
}

/**
 * Handle authentication state changes
 */
async function handleAuthStateChanged(user) {
  if (user) {
    console.log("[TabDog] User logged in:", user.email);
    
    // Register device
    await registerDevice(user.uid);
    
    // Start sync
    await startSync();
    
    // Set up periodic sync
    startPeriodicSync();
  } else {
    console.log("[TabDog] User logged out");
    
    // Stop sync
    stopSync();
    stopPeriodicSync();
  }
}

/**
 * Start periodic tab sync using chrome.alarms (survives service worker termination)
 */
async function startPeriodicSync() {
  // Clear existing alarm if any
  await chrome.alarms.clear(SYNC_ALARM_NAME);
  
  // Create alarm that fires every minute
  await chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  
  console.log(`[TabDog] Periodic sync alarm set (every ${SYNC_INTERVAL_MINUTES} minute(s))`);
  
  // Run initial sync immediately
  await runPeriodicSync();
}

/**
 * Stop periodic tab sync
 */
async function stopPeriodicSync() {
  await chrome.alarms.clear(SYNC_ALARM_NAME);
  console.log("[TabDog] Periodic sync alarm cleared");
}

/**
 * Run periodic sync tasks
 */
async function runPeriodicSync() {
  const user = getCurrentUser();
  if (user) {
    console.log("[TabDog] Running periodic sync...");
    await syncAllTabs();
    await updateDeviceStatus(user.uid, true);
    await syncWorkspaces();
  }
}

/**
 * Load tab creation times from storage
 */
async function loadTabCreationTimes() {
  try {
    const result = await chrome.storage.local.get(TAB_TIMES_KEY);
    tabCreationTimes = result[TAB_TIMES_KEY] || {};
    console.log(`[TabDog] Loaded ${Object.keys(tabCreationTimes).length} tab creation times`);
  } catch (error) {
    console.error("[TabDog] Failed to load tab times:", error);
    tabCreationTimes = {};
  }
}

/**
 * Save tab creation times to storage
 */
async function saveTabCreationTimes() {
  try {
    await chrome.storage.local.set({ [TAB_TIMES_KEY]: tabCreationTimes });
  } catch (error) {
    console.error("[TabDog] Failed to save tab times:", error);
  }
}

/**
 * Record creation times for existing tabs (on extension startup)
 */
async function recordExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    let newCount = 0;
    
    for (const tab of tabs) {
      if (!tabCreationTimes[tab.id]) {
        // Use current time as a fallback for tabs that existed before extension
        tabCreationTimes[tab.id] = now;
        newCount++;
      }
      
      // Cache tab info for history tracking
      tabInfoCache.set(tab.id, {
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      });
    }
    
    // Clean up times for tabs that no longer exist
    const existingIds = new Set(tabs.map(t => t.id));
    for (const tabId of Object.keys(tabCreationTimes)) {
      if (!existingIds.has(parseInt(tabId))) {
        delete tabCreationTimes[tabId];
      }
    }
    
    if (newCount > 0) {
      await saveTabCreationTimes();
      console.log(`[TabDog] Recorded ${newCount} existing tabs, cleaned up old entries`);
    }
  } catch (error) {
    console.error("[TabDog] Failed to record existing tabs:", error);
  }
}

// ============================================================================
// BADGE
// ============================================================================

/**
 * Update the extension badge with current tab count
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;
    
    // Set badge text (show number)
    await chrome.action.setBadgeText({ text: count.toString() });
    
    // Set badge colors - dark charcoal background with white text
    await chrome.action.setBadgeBackgroundColor({ color: '#2D2D2D' });
    await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  } catch (error) {
    console.error("[TabDog] Failed to update badge:", error);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Track new tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  tabCreationTimes[tab.id] = Date.now();
  tabInfoCache.set(tab.id, { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
  await saveTabCreationTimes();
  await updateBadge();
  
  // Sync new tab if logged in
  if (getCurrentUser()) {
    syncTab(tab);
  }
});

// Track tab updates (URL, title changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Update tab info cache
  const existing = tabInfoCache.get(tabId) || {};
  
  tabInfoCache.set(tabId, {
    url: tab.url || existing.url,
    title: tab.title || existing.title,
    favIconUrl: tab.favIconUrl || existing.favIconUrl
  });
  
  // Only sync on meaningful changes
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
    if (getCurrentUser()) {
      syncTab(tab);
    }
  }
});

// Clean up when tab is removed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  tabInfoCache.delete(tabId);
  
  delete tabCreationTimes[tabId];
  await saveTabCreationTimes();
  await updateBadge();
  
  // Remove from sync if logged in
  if (getCurrentUser()) {
    await removeTab(tabId);
  }
});

// Handle extension suspension (for cleanup)
chrome.runtime.onSuspend.addListener(async () => {
  const user = getCurrentUser();
  if (user) {
    await updateDeviceStatus(user.uid, false);
  }
});

// Handle alarm events (for periodic sync and session save)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    await runPeriodicSync();
  } else if (alarm.name === SESSION_ALARM_NAME) {
    await saveCurrentSession();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'signIn') {
    console.log('[TabDog] Received signIn request from popup');
    signInWithGoogle()
      .then(user => {
        console.log('[TabDog] Sign in successful:', user.email);
        sendResponse({ success: true, user });
      })
      .catch(error => {
        console.error('[TabDog] Sign in failed:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'signOut') {
    console.log('[TabDog] Received signOut request from popup');
    signOut()
      .then(() => {
        console.log('[TabDog] Sign out successful');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('[TabDog] Sign out failed:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }
  
  if (message.action === 'getAuthState') {
    const user = getCurrentUser();
    sendResponse({ user });
    return false;
  }
  
  if (message.action === 'activateTab') {
    const { tabId } = message;
    chrome.tabs.get(tabId)
      .then(tab => chrome.windows.update(tab.windowId, { focused: true }))
      .then(() => chrome.tabs.update(tabId, { active: true }))
      .catch(error => console.error('[TabDog] Failed to activate tab:', error));
    return false;
  }
});

// ============================================================================
// SESSION SAVING
// ============================================================================

/**
 * Save current session when browser is about to close
 * Note: onSuspend is not reliable in Manifest V3, so we also save periodically
 */
async function saveCurrentSession() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    const tabs = await chrome.tabs.query({});
    // Filter out extension pages and new tab pages
    const validTabs = tabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('about:')
    );
    
    if (validTabs.length > 0) {
      console.log('[TabDog] Saving session with', validTabs.length, 'tabs');
      await saveSession(validTabs);
    }
  } catch (error) {
    console.error('[TabDog] Failed to save session:', error);
  }
}

// Listen for browser suspend (not always called in MV3)
chrome.runtime.onSuspend?.addListener(() => {
  console.log('[TabDog] Extension suspending, saving session...');
  saveCurrentSession();
});

// Track window tabs before they close
const windowTabsCache = new Map();

// Update window tabs cache when tabs change
async function updateWindowTabsCache(windowId) {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    const validTabs = tabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('brave://') &&
      !tab.url.startsWith('edge://') &&
      !tab.url.startsWith('about:') &&
      !tab.url.startsWith('moz-extension://')
    );
    if (validTabs.length > 0) {
      windowTabsCache.set(windowId, validTabs);
    }
  } catch (error) {
    // Window might be closed already
  }
}

// Update cache when tabs are created, updated, or removed
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.windowId) updateWindowTabsCache(tab.windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.windowId && changeInfo.url) updateWindowTabsCache(tab.windowId);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (!removeInfo.isWindowClosing && removeInfo.windowId) {
    updateWindowTabsCache(removeInfo.windowId);
  }
});

// Save session when window is closed
chrome.windows.onRemoved.addListener(async (windowId) => {
  const user = getCurrentUser();
  if (!user) return;
  
  const cachedTabs = windowTabsCache.get(windowId);
  if (cachedTabs && cachedTabs.length > 0) {
    console.log('[TabDog] Window closed, saving session with', cachedTabs.length, 'tabs');
    try {
      await saveSession(cachedTabs);
    } catch (error) {
      console.error('[TabDog] Failed to save window session:', error);
    }
  }
  windowTabsCache.delete(windowId);
});

// Initialize cache for existing windows
async function initWindowTabsCache() {
  try {
    const windows = await chrome.windows.getAll();
    for (const window of windows) {
      await updateWindowTabsCache(window.id);
    }
  } catch (error) {
    console.error('[TabDog] Failed to init window tabs cache:', error);
  }
}

// Initialize cache on startup
initWindowTabsCache();

// Periodic session save using alarms (more reliable than setInterval in MV3)
// Create session save alarm (30 seconds for testing)
chrome.alarms.create(SESSION_ALARM_NAME, { 
  delayInMinutes: SESSION_INTERVAL_SECONDS / 60,
  periodInMinutes: SESSION_INTERVAL_SECONDS / 60 
});

// ============================================================================
// STARTUP
// ============================================================================

// Initialize on extension load
initialize();

// Start session auto-save if user is already logged in
setTimeout(async () => {
  const user = getCurrentUser();
  if (user) {
    startSessionAutoSave();
  }
}, 5000);

console.log("[TabDog] Background service worker loaded");
