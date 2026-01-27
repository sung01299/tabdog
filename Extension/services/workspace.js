/**
 * Workspace Service
 * 
 * Manages saved tab workspaces with local cache and cloud sync.
 */

import { getCurrentUser, getIdToken } from './auth.js';
import { firestoreSet, firestoreGet, firestoreDelete, firestoreList } from './firestore.js';

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
export async function createWorkspace(name, tabs) {
  const user = getCurrentUser();
  const workspaceId = generateId();
  const now = new Date().toISOString();
  
  const workspace = {
    id: workspaceId,
    name,
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
 * Restore a workspace (open its tabs)
 * @param {string} workspaceId - Workspace ID
 */
export async function restoreWorkspace(workspaceId) {
  const workspace = workspacesCache.find(w => w.id === workspaceId);
  
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  
  // Open all workspace tabs
  for (const tab of workspace.tabs) {
    await chrome.tabs.create({
      url: tab.url,
      pinned: tab.pinned,
      active: false,
    });
  }
  
  console.log(`[Workspace] Opened ${workspace.tabs.length} tabs`);
  
  // Update last used timestamp
  await updateWorkspace(workspaceId, { lastUsedAt: new Date().toISOString() });
}

/**
 * Sync workspaces with cloud
 */
export async function syncWorkspaces() {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    // Fetch from cloud
    const cloudWorkspaces = await firestoreList(`users/${user.uid}/workspaces`);
    
    // Merge local and cloud (cloud wins for conflicts)
    const merged = mergeWorkspaces(workspacesCache, cloudWorkspaces);
    
    workspacesCache = merged;
    await saveToLocalStorage();
    
    // Update sync timestamp
    await chrome.storage.local.set({ [SYNC_KEY]: Date.now() });
    
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

/**
 * Merge local and cloud workspaces
 * @param {Array} local - Local workspaces
 * @param {Array} cloud - Cloud workspaces
 * @returns {Array} Merged workspaces
 */
function mergeWorkspaces(local, cloud) {
  const merged = new Map();
  
  // Add all cloud workspaces
  for (const workspace of cloud) {
    merged.set(workspace.id, workspace);
  }
  
  // Add local workspaces that don't exist in cloud
  // or that are newer than cloud version
  for (const workspace of local) {
    const cloudVersion = merged.get(workspace.id);
    
    if (!cloudVersion) {
      merged.set(workspace.id, workspace);
    } else {
      // Keep the newer version
      const localTime = new Date(workspace.updatedAt).getTime();
      const cloudTime = new Date(cloudVersion.updatedAt).getTime();
      
      if (localTime > cloudTime) {
        merged.set(workspace.id, workspace);
      }
    }
  }
  
  // Sort by updatedAt descending
  return Array.from(merged.values()).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
