/**
 * TabDoggy Bridge - Chrome Extension Background Service Worker
 * 
 * This service worker:
 * 1. Connects to the TabDoggy macOS app via Native Messaging
 * 2. Collects tab information from Chrome
 * 3. Tracks tab creation times
 * 4. Sends updates to the app and handles commands from it
 */

const HOST_NAME = "com.tabdoggy.host";
const UPDATE_INTERVAL_MS = 2000; // Update every 2 seconds
const TAB_TIMES_KEY = "tabCreationTimes";

let port = null;
let updateIntervalId = null;

// In-memory cache of tab creation times (tabId -> timestamp)
let tabCreationTimes = {};

// Track the globally active tab (last focused across all windows)
let lastActiveTabId = null;

// Detect which browser we're running in
const BROWSER_TYPE = detectBrowser();

/**
 * Detect the browser type based on user agent and available APIs
 */
function detectBrowser() {
  const ua = navigator.userAgent;
  
  if (ua.includes("Edg/")) {
    return "edge";
  } else if (ua.includes("Brave")) {
    return "brave";
  } else if (ua.includes("OPR/") || ua.includes("Opera")) {
    return "opera";
  } else if (ua.includes("Vivaldi")) {
    return "vivaldi";
  } else if (ua.includes("Chrome")) {
    // Could be Chrome or Brave (Brave sometimes doesn't include "Brave" in UA)
    // Try to detect Brave via its specific API
    if (navigator.brave && navigator.brave.isBrave) {
      return "brave";
    }
    return "chrome";
  }
  return "unknown";
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the extension on startup
 */
async function initialize() {
  console.log(`[TabDoggy] Initializing extension... (Browser: ${BROWSER_TYPE})`);
  
  // Load saved tab creation times
  await loadTabCreationTimes();
  
  // Record times for existing tabs that we don't have
  await recordExistingTabs();
  
  connectToNativeApp();
}

/**
 * Load tab creation times from storage
 */
async function loadTabCreationTimes() {
  try {
    const result = await chrome.storage.local.get(TAB_TIMES_KEY);
    tabCreationTimes = result[TAB_TIMES_KEY] || {};
    console.log(`[TabDoggy] Loaded ${Object.keys(tabCreationTimes).length} tab creation times`);
  } catch (error) {
    console.error("[TabDoggy] Failed to load tab times:", error);
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
    console.error("[TabDoggy] Failed to save tab times:", error);
  }
}

/**
 * Record creation times for existing tabs (on extension startup)
 */
async function recordExistingTabs() {
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
    console.log(`[TabDoggy] Recorded ${newCount} existing tabs, cleaned up old entries`);
  }
}

// ============================================================================
// NATIVE MESSAGING
// ============================================================================

/**
 * Connect to the TabDoggy native macOS app
 */
function connectToNativeApp() {
  try {
    console.log(`[TabDoggy] Connecting to native host: ${HOST_NAME}`);
    port = chrome.runtime.connectNative(HOST_NAME);
    
    port.onMessage.addListener(handleNativeMessage);
    port.onDisconnect.addListener(handleDisconnect);
    
    // Send connection status with browser type
    sendMessage({
      type: "CONNECTION_STATUS",
      status: "connected",
      browser: BROWSER_TYPE,
      extensionVersion: chrome.runtime.getManifest().version
    });
    
    // Start sending updates
    startUpdates();
    
    console.log("[TabDoggy] Connected to native app");
  } catch (error) {
    console.error("[TabDoggy] Failed to connect:", error);
  }
}

/**
 * Handle disconnect from native app
 */
function handleDisconnect() {
  const error = chrome.runtime.lastError;
  console.log("[TabDoggy] Disconnected from native app:", error?.message || "No error");
  
  stopUpdates();
  port = null;
  
  // Try to reconnect after a delay
  setTimeout(() => {
    console.log("[TabDoggy] Attempting to reconnect...");
    connectToNativeApp();
  }, 5000);
}

/**
 * Send a message to the native app
 */
function sendMessage(message) {
  if (port) {
    try {
      port.postMessage(message);
    } catch (error) {
      console.error("[TabDoggy] Failed to send message:", error);
    }
  }
}

/**
 * Handle messages from the native app
 */
function handleNativeMessage(message) {
  console.log("[TabDoggy] Received message:", message.type);
  
  switch (message.type) {
    case "CLOSE_TAB":
      closeTab(message.tabId);
      break;
      
    case "CLOSE_TABS":
      closeTabs(message.tabIds);
      break;
      
    case "ACTIVATE_TAB":
      activateTab(message.tabId, message.windowId);
      break;

    case "OPEN_URL":
      openUrl(message.url);
      break;
      
    case "REQUEST_UPDATE":
      sendTabsUpdate();
      break;
      
    default:
      console.warn("[TabDoggy] Unknown message type:", message.type);
  }
}

// ============================================================================
// TAB COLLECTION
// ============================================================================

/**
 * Start periodic tab updates
 */
function startUpdates() {
  if (updateIntervalId) return;
  
  // Send initial update
  sendTabsUpdate();
  
  // Set up periodic updates
  updateIntervalId = setInterval(sendTabsUpdate, UPDATE_INTERVAL_MS);
  console.log("[TabDoggy] Started periodic updates");
}

/**
 * Stop periodic tab updates
 */
function stopUpdates() {
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
    console.log("[TabDoggy] Stopped periodic updates");
  }
}

/**
 * Collect tab data and send to native app
 */
async function sendTabsUpdate() {
  try {
    const tabs = await collectTabData();
    
    sendMessage({
      type: "TABS_UPDATE",
      timestamp: Date.now(),
      browser: BROWSER_TYPE,
      data: {
        tabs,
        tabCount: tabs.length,
        browser: BROWSER_TYPE
      }
    });
  } catch (error) {
    console.error("[TabDoggy] Failed to collect tab data:", error);
    sendMessage({
      type: "ERROR",
      code: "TAB_COLLECTION_FAILED",
      message: error.message
    });
  }
}

/**
 * Collect information about all tabs
 */
async function collectTabData() {
  const tabs = await chrome.tabs.query({});
  
  // If we don't have a lastActiveTabId yet, find the active tab in the focused window
  if (lastActiveTabId === null) {
    const [focusedWindow] = await chrome.windows.getAll({ windowTypes: ['normal'] });
    if (focusedWindow) {
      const activeTabs = tabs.filter(t => t.active && t.windowId === focusedWindow.id);
      if (activeTabs.length > 0) {
        lastActiveTabId = activeTabs[0].id;
      }
    }
  }
  
  return tabs.map(tab => ({
    tabId: tab.id,
    windowId: tab.windowId,
    title: tab.title || "Untitled",
    url: tab.url || "",
    favIconUrl: tab.favIconUrl || null,
    active: tab.id === lastActiveTabId,  // Only ONE tab is globally active
    pinned: tab.pinned,
    openedAt: tabCreationTimes[tab.id] || Date.now()
  }));
}

// ============================================================================
// TAB COMMANDS
// ============================================================================

/**
 * Close a tab
 */
async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    delete tabCreationTimes[tabId];
    await saveTabCreationTimes();
    console.log(`[TabDoggy] Closed tab ${tabId}`);
    sendTabsUpdate();
  } catch (error) {
    console.error(`[TabDoggy] Failed to close tab ${tabId}:`, error);
  }
}

/**
 * Close multiple tabs
 */
async function closeTabs(tabIds) {
  try {
    await chrome.tabs.remove(tabIds);
    for (const tabId of tabIds) {
      delete tabCreationTimes[tabId];
    }
    await saveTabCreationTimes();
    console.log(`[TabDoggy] Closed ${tabIds.length} tabs`);
    sendTabsUpdate();
  } catch (error) {
    console.error(`[TabDoggy] Failed to close tabs:`, error);
  }
}

/**
 * Activate (focus) a tab
 */
async function activateTab(tabId, windowId) {
  try {
    await chrome.windows.update(windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
    console.log(`[TabDoggy] Activated tab ${tabId} in window ${windowId}`);
  } catch (error) {
    console.error(`[TabDoggy] Failed to activate tab ${tabId}:`, error);
  }
}

/**
 * Open a URL in a new tab (and focus it).
 */
async function openUrl(url) {
  try {
    if (!url || typeof url !== "string") {
      return;
    }

    const created = await chrome.tabs.create({ url, active: true });
    if (created?.id) {
      lastActiveTabId = created.id;
      tabCreationTimes[created.id] = Date.now();
      await saveTabCreationTimes();
    }
    console.log(`[TabDoggy] Opened URL: ${url}`);
    sendTabsUpdate();
  } catch (error) {
    console.error(`[TabDoggy] Failed to open URL: ${url}`, error);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Track new tab creation
chrome.tabs.onCreated.addListener(async (tab) => {
  tabCreationTimes[tab.id] = Date.now();
  await saveTabCreationTimes();
  console.log(`[TabDoggy] New tab created: ${tab.id}`);
  sendTabsUpdate();
});

// Clean up when tab is removed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  delete tabCreationTimes[tabId];
  await saveTabCreationTimes();
  sendTabsUpdate();
});

// Update on tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.title || changeInfo.url) {
    sendTabsUpdate();
  }
});

// Track when a tab becomes active (globally)
chrome.tabs.onActivated.addListener((activeInfo) => {
  lastActiveTabId = activeInfo.tabId;
  console.log(`[TabDoggy] Tab activated: ${activeInfo.tabId}`);
  sendTabsUpdate();
});

// Track when window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return; // No window focused (e.g., clicked outside Chrome)
  }
  
  try {
    // Get the active tab in the newly focused window
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      lastActiveTabId = tabs[0].id;
      console.log(`[TabDoggy] Window focus changed, active tab: ${lastActiveTabId}`);
      sendTabsUpdate();
    }
  } catch (error) {
    // Window might have closed
  }
});

// Initialize on extension load
initialize();

console.log("[TabDoggy] Background service worker loaded");
