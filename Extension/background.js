/**
 * TabDog - Chrome Extension Background Service Worker
 * 
 * This service worker tracks tab creation times to enable
 * duration display in the popup UI.
 */

const TAB_TIMES_KEY = "tabCreationTimes";

// In-memory cache of tab creation times (tabId -> timestamp)
let tabCreationTimes = {};

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
  
  console.log("[TabDog] Extension initialized");
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
});

// Clean up when tab is removed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  delete tabCreationTimes[tabId];
  await saveTabCreationTimes();
  await updateBadge();
});

// ============================================================================
// STARTUP
// ============================================================================

// Initialize on extension load
initialize();

console.log("[TabDog] Background service worker loaded");
