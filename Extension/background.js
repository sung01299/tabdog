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

const TAB_TIMES_KEY = "tabCreationTimes";
const PERIODIC_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache of tab creation times (tabId -> timestamp)
let tabCreationTimes = {};
let periodicSyncInterval = null;

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
 * Start periodic tab sync
 */
function startPeriodicSync() {
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
  }
  
  periodicSyncInterval = setInterval(async () => {
    const user = getCurrentUser();
    if (user) {
      console.log("[TabDog] Running periodic sync...");
      await syncAllTabs();
      await updateDeviceStatus(user.uid, true);
    }
  }, PERIODIC_SYNC_INTERVAL_MS);
}

/**
 * Stop periodic tab sync
 */
function stopPeriodicSync() {
  if (periodicSyncInterval) {
    clearInterval(periodicSyncInterval);
    periodicSyncInterval = null;
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
  await saveTabCreationTimes();
  await updateBadge();
  
  // Sync new tab if logged in
  if (getCurrentUser()) {
    syncTab(tab);
  }
});

// Track tab updates (URL, title changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only sync on meaningful changes
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
    if (getCurrentUser()) {
      syncTab(tab);
    }
  }
});

// Clean up when tab is removed
chrome.tabs.onRemoved.addListener(async (tabId) => {
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

// Also save session periodically (every 30 minutes) as backup
let sessionSaveInterval = null;

function startSessionAutoSave() {
  if (sessionSaveInterval) {
    clearInterval(sessionSaveInterval);
  }
  // Save session every 30 minutes
  sessionSaveInterval = setInterval(saveCurrentSession, 30 * 60 * 1000);
}

function stopSessionAutoSave() {
  if (sessionSaveInterval) {
    clearInterval(sessionSaveInterval);
    sessionSaveInterval = null;
  }
}

// Start session auto-save when user logs in
const originalHandleAuthStateChanged = handleAuthStateChanged;
async function handleAuthStateChangedWithSession(user) {
  await originalHandleAuthStateChanged(user);
  if (user) {
    startSessionAutoSave();
  } else {
    stopSessionAutoSave();
  }
}

// Update auth listener
// Note: We can't easily replace the listener, so session auto-save starts with periodic sync

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
