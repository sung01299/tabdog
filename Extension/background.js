/**
 * TabDog - Chrome Extension Background Service Worker
 * 
 * This service worker tracks tab creation times to enable
 * duration display in the popup UI.
 * 
 * Also handles workspace sync and session saving when user is logged in.
 */

import { initAuth, onAuthStateChanged, getCurrentUser, signInWithGoogle, signOut } from './services/auth.js';
import { extractTabContent } from './services/content-extractor.js';
import { saveSession } from './services/session-history.js';
import { syncWorkspaces } from './services/workspace.js';

const TAB_TIMES_KEY = "tabCreationTimes";
const SYNC_ALARM_NAME = "tabdog-sync";
const SESSION_ALARM_NAME = "tabdog-session";
const SYNC_INTERVAL_MINUTES = 1;
const SESSION_INTERVAL_SECONDS = 3600;

// In-memory cache of tab creation times (tabId -> timestamp)
let tabCreationTimes = {};

// In-memory cache of tab info for history (tabId -> tab info)
const tabInfoCache = new Map();

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize() {
  console.log("[TabDog] Initializing extension...");
  
  await loadTabCreationTimes();
  await recordExistingTabs();
  await updateBadge();
  await initAuth();
  
  onAuthStateChanged(handleAuthStateChanged);
  
  console.log("[TabDog] Extension initialized");
}

async function handleAuthStateChanged(user) {
  if (user) {
    console.log("[TabDog] User logged in:", user.email);
    startPeriodicSync();
  } else {
    console.log("[TabDog] User logged out");
    stopPeriodicSync();
  }
}

// ============================================================================
// PERIODIC SYNC
// ============================================================================

async function startPeriodicSync() {
  await chrome.alarms.clear(SYNC_ALARM_NAME);
  await chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
  console.log(`[TabDog] Periodic sync alarm set (every ${SYNC_INTERVAL_MINUTES} minute(s))`);
  await runPeriodicSync();
}

async function stopPeriodicSync() {
  await chrome.alarms.clear(SYNC_ALARM_NAME);
  console.log("[TabDog] Periodic sync alarm cleared");
}

async function runPeriodicSync() {
  const user = getCurrentUser();
  if (user) {
    console.log("[TabDog] Running periodic sync...");
    await syncWorkspaces();
  }
}

// ============================================================================
// TAB CREATION TIMES
// ============================================================================

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

async function saveTabCreationTimes() {
  try {
    await chrome.storage.local.set({ [TAB_TIMES_KEY]: tabCreationTimes });
  } catch (error) {
    console.error("[TabDog] Failed to save tab times:", error);
  }
}

async function recordExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    let newCount = 0;
    
    for (const tab of tabs) {
      if (!tabCreationTimes[tab.id]) {
        tabCreationTimes[tab.id] = now;
        newCount++;
      }
      tabInfoCache.set(tab.id, {
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      });
    }
    
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

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;
    await chrome.action.setBadgeText({ text: count.toString() });
    await chrome.action.setBadgeBackgroundColor({ color: '#2D2D2D' });
    await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  } catch (error) {
    console.error("[TabDog] Failed to update badge:", error);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

chrome.tabs.onCreated.addListener(async (tab) => {
  tabCreationTimes[tab.id] = Date.now();
  tabInfoCache.set(tab.id, { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
  await saveTabCreationTimes();
  await updateBadge();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const existing = tabInfoCache.get(tabId) || {};
  tabInfoCache.set(tabId, {
    url: tab.url || existing.url,
    title: tab.title || existing.title,
    favIconUrl: tab.favIconUrl || existing.favIconUrl
  });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  tabInfoCache.delete(tabId);
  delete tabCreationTimes[tabId];
  await saveTabCreationTimes();
  await updateBadge();
});

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
    return true;
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

  if (message.action === 'updateTabGroup') {
    const { groupId, title, color } = message;
    chrome.tabGroups.update(groupId, { title, color })
      .then(() => {
        console.log(`[TabDog] Tab group "${title}" updated`);
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('[TabDog] Failed to update tab group:', error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  if (message.action === 'extractTabContent') {
    const { tabId } = message;
    console.log('[TabDog Chat][Background] extractTabContent message received', {
      tabId,
      sender: {
        documentId: sender?.documentId,
        url: sender?.url,
        origin: sender?.origin,
      },
    });

    extractTabContent(tabId)
      .then((result) => {
        console.log('[TabDog Chat][Background] extractTabContent result', result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error('[TabDog Chat][Background] Failed to extract tab content:', error);
        sendResponse({
          ok: false,
          error: 'unexpected_error',
          message: error?.message || 'Failed to extract content from the selected tab.',
        });
      });

    return true;
  }
});

// ============================================================================
// SESSION SAVING
// ============================================================================

async function saveCurrentSession() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    const tabs = await chrome.tabs.query({});
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

chrome.runtime.onSuspend?.addListener(() => {
  console.log('[TabDog] Extension suspending, saving session...');
  saveCurrentSession();
});

// Track window tabs before they close
const windowTabsCache = new Map();

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

initWindowTabsCache();

chrome.alarms.create(SESSION_ALARM_NAME, { 
  delayInMinutes: SESSION_INTERVAL_SECONDS / 60,
  periodInMinutes: SESSION_INTERVAL_SECONDS / 60 
});

// ============================================================================
// STARTUP
// ============================================================================

initialize();

console.log("[TabDog] Background service worker loaded");
