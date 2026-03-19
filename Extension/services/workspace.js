/**
 * Workspace Service
 * 
 * Manages saved tab workspaces with local cache and cloud sync.
 */

import { getCurrentUser, getIdToken } from './auth.js';
import { firestoreSet, firestoreDelete, firestoreList } from './firestore.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOCAL_STORAGE_KEY = 'workspaces';
const SYNC_KEY = 'lastSyncedWorkspaces';

// ============================================================================
// STATE
// ============================================================================

let workspacesCache = [];
let workspaceListeners = [];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize workspaces from local storage
 */
export async function initWorkspaces() {
  const stored = await chrome.storage.local.get([LOCAL_STORAGE_KEY]);
  workspacesCache = stored[LOCAL_STORAGE_KEY] || [];
  return workspacesCache;
}

/**
 * Get all workspaces
 * @returns {Array} List of workspaces
 */
export function getWorkspaces() {
  return workspacesCache;
}

/**
 * Create a new workspace
 * @param {string} name - Workspace name
 * @param {Array} tabs - Array of tab objects
 * @returns {Promise<Object>} Created workspace
 */
export async function createWorkspace(name, tabs, color = 'blue') {
  const user = getCurrentUser();
  const workspaceId = generateId();
  const now = new Date().toISOString();
  
  const workspace = {
    id: workspaceId,
    name,
    color,
    tabs: tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned || false,
    })),
    createdAt: now,
    updatedAt: now,
  };
  
  // Add to local cache
  workspacesCache.push(workspace);
  await saveToLocalStorage();
  
  // Save to cloud if logged in
  if (user) {
    try {
      await firestoreSet(`users/${user.uid}/workspaces/${workspaceId}`, workspace);
    } catch (error) {
      console.error('Failed to save workspace to cloud:', error);
    }
  }
  
  notifyListeners();
  return workspace;
}

/**
 * Update an existing workspace
 * @param {string} workspaceId - Workspace ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated workspace
 */
export async function updateWorkspace(workspaceId, updates) {
  const user = getCurrentUser();
  const index = workspacesCache.findIndex(w => w.id === workspaceId);
  
  if (index === -1) {
    throw new Error('Workspace not found');
  }
  
  const workspace = {
    ...workspacesCache[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  workspacesCache[index] = workspace;
  await saveToLocalStorage();
  
  // Update cloud if logged in
  if (user) {
    try {
      await firestoreSet(`users/${user.uid}/workspaces/${workspaceId}`, workspace, true);
    } catch (error) {
      console.error('Failed to update workspace in cloud:', error);
    }
  }
  
  notifyListeners();
  return workspace;
}

/**
 * Delete a workspace
 * @param {string} workspaceId - Workspace ID
 */
export async function deleteWorkspace(workspaceId) {
  const user = getCurrentUser();
  
  workspacesCache = workspacesCache.filter(w => w.id !== workspaceId);
  await saveToLocalStorage();
  
  // Delete from cloud if logged in
  if (user) {
    try {
      await firestoreDelete(`users/${user.uid}/workspaces/${workspaceId}`);
    } catch (error) {
      console.error('Failed to delete workspace from cloud:', error);
    }
  }
  
  notifyListeners();
}

/**
 * Map TabDog color names to Chrome tabGroups color names.
 * Chrome supports: grey, blue, red, yellow, green, pink, purple, cyan, orange
 */
const TAB_GROUP_COLOR_MAP = {
  blue: 'blue',
  purple: 'purple',
  pink: 'pink',
  red: 'red',
  orange: 'orange',
  yellow: 'yellow',
  green: 'green',
  teal: 'cyan',
  gray: 'grey',
};

/**
 * Restore a workspace (open its tabs as a native Chrome tab group)
 * Tab creation and grouping run in the popup.
 * The group title/color update is delegated to the background service worker
 * and awaited, so the popup stays alive until the update completes.
 * @param {string} workspaceId - Workspace ID
 */
export async function restoreWorkspace(workspaceId) {
  const workspace = workspacesCache.find(w => w.id === workspaceId);
  
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  
  const pinnedTabs = workspace.tabs.filter(t => t.pinned);
  const normalTabs = workspace.tabs.filter(t => !t.pinned);

  for (const tab of pinnedTabs) {
    await chrome.tabs.create({ url: tab.url, pinned: true, active: false });
  }

  const createdTabIds = [];
  for (const tab of normalTabs) {
    const created = await chrome.tabs.create({ url: tab.url, active: false });
    createdTabIds.push(created.id);
  }

  if (createdTabIds.length > 0) {
    const groupId = await chrome.tabs.group({ tabIds: createdTabIds });

    // Delegate title/color update to background service worker and AWAIT the response.
    // This keeps the popup alive until the background confirms the update.
    try {
      await chrome.runtime.sendMessage({
        action: 'updateTabGroup',
        groupId,
        title: workspace.name,
        color: TAB_GROUP_COLOR_MAP[workspace.color] || 'blue',
      });
    } catch (error) {
      console.warn('[Workspace] Background tab group update failed, trying directly:', error);
      try {
        await chrome.tabGroups.update(groupId, {
          title: workspace.name,
          color: TAB_GROUP_COLOR_MAP[workspace.color] || 'blue',
        });
      } catch (e) {
        console.warn('[Workspace] Direct tab group update also failed:', e);
      }
    }
  }
  
  console.log(`[Workspace] Opened ${workspace.tabs.length} tabs as group "${workspace.name}"`);
}

/**
 * Sync workspaces with cloud using two-way merge.
 * - Workspaces only in cloud → add locally
 * - Workspaces only locally → push to cloud
 * - Workspaces in both → keep the one with the newer updatedAt
 */
export async function syncWorkspaces() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    // Always reload from local storage first so the background service worker
    // (which never calls initWorkspaces) has the latest local data.
    const stored = await chrome.storage.local.get([LOCAL_STORAGE_KEY]);
    workspacesCache = stored[LOCAL_STORAGE_KEY] || [];

    const cloudWorkspaces = await firestoreList(`users/${user.uid}/workspaces`);
    
    const cloudMap = new Map(cloudWorkspaces.map(w => [w.id, w]));
    const localMap = new Map(workspacesCache.map(w => [w.id, w]));
    const merged = [];
    
    // Process cloud workspaces
    for (const [id, cloudW] of cloudMap) {
      const localW = localMap.get(id);
      if (!localW) {
        merged.push(cloudW);
      } else {
        const cloudTime = new Date(cloudW.updatedAt || 0).getTime();
        const localTime = new Date(localW.updatedAt || 0).getTime();
        merged.push(cloudTime >= localTime ? cloudW : localW);
      }
      localMap.delete(id);
    }
    
    // Local-only workspaces: keep locally and push to cloud
    for (const [id, localW] of localMap) {
      merged.push(localW);
      try {
        await firestoreSet(`users/${user.uid}/workspaces/${id}`, localW);
      } catch (e) {
        console.warn('[Workspace] Failed to push local workspace to cloud:', e);
      }
    }
    
    workspacesCache = merged.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    await saveToLocalStorage();
    await chrome.storage.local.set({ [SYNC_KEY]: Date.now() });
    
    console.log(`[Workspace] Synced ${workspacesCache.length} workspaces (cloud: ${cloudWorkspaces.length}, local-only pushed: ${localMap.size})`);
    
    notifyListeners();
  } catch (error) {
    console.error('Failed to sync workspaces:', error);
  }
}

/**
 * Subscribe to workspace changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function onWorkspacesChanged(callback) {
  workspaceListeners.push(callback);
  return () => {
    workspaceListeners = workspaceListeners.filter(cb => cb !== callback);
  };
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Save workspaces to local storage
 */
async function saveToLocalStorage() {
  await chrome.storage.local.set({ [LOCAL_STORAGE_KEY]: workspacesCache });
}

/**
 * Notify all listeners of workspace changes
 */
function notifyListeners() {
  workspaceListeners.forEach(cb => cb(workspacesCache));
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

