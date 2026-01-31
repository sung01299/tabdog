/**
 * TabDog Popup - Main UI Controller
 * 
 * Handles:
 * - Tab loading and rendering
 * - Search filtering
 * - Domain grouping
 * - Sorting (newest/oldest)
 * - Tab actions (activate, close)
 * - Recently closed tabs
 * - Keyboard navigation
 * - Authentication and cloud sync
 * - Other devices tabs
 */

import { initAuth, signInWithGoogle, signOut, onAuthStateChanged, getCurrentUser } from '../services/auth.js';
import { getRemoteTabs, onRemoteTabsChanged } from '../services/sync.js';
import { initWorkspaces, getWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace, restoreWorkspace, syncWorkspaces, onWorkspacesChanged } from '../services/workspace.js';
// Using chrome.history API instead of custom tab-history service
import { createShareLink, EXPIRATION_OPTIONS } from '../services/share.js';

// ============================================================================
// STATE
// ============================================================================

const state = {
  tabs: [],
  filteredTabs: [],
  recentlyClosed: [],
  searchQuery: '',
  groupByDomain: true,
  expandedDomains: new Set(),
  expandedDevices: new Set(),
  selectedIndex: -1, // -1 means search input is focused
  tabCreationTimes: {},
  recentlyClosedExpanded: false,
  theme: 'light', // 'light' or 'dark'
  user: null,
  remoteTabs: {},
  workspaces: [],
  tabHistory: [],
  selectedWorkspaceId: null,
  selectedTabs: new Set(), // For sharing
  selectedColor: 'blue', // Default workspace color
  customTabs: [], // Custom URLs added by user
  editingWorkspaceId: null, // ID of workspace being edited
  currentPage: 'tabs', // 'tabs', 'devices', 'workspaces', 'history'
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
  // Login screen
  loginScreen: document.getElementById('loginScreen'),
  loginBtn: document.getElementById('loginBtn'),
  appContent: document.getElementById('appContent'),
  // App content
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  searchInput: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearch'),
  toolbar: document.getElementById('toolbar'),
  // Pages
  pageContainer: document.getElementById('pageContainer'),
  pageTabs: document.getElementById('pageTabs'),
  pageDevices: document.getElementById('pageDevices'),
  pageWorkspaces: document.getElementById('pageWorkspaces'),
  pageHistory: document.getElementById('pageHistory'),
  bottomNav: document.getElementById('bottomNav'),
  // Tabs page
  tabList: document.getElementById('tabList'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  recentlyClosedSection: document.getElementById('recentlyClosedSection'),
  recentlyClosedHeader: document.getElementById('recentlyClosedHeader'),
  recentlyClosedCount: document.getElementById('recentlyClosedCount'),
  recentlyClosedList: document.getElementById('recentlyClosedList'),
  // Devices page
  otherDevicesList: document.getElementById('otherDevicesList'),
  emptyDevicesState: document.getElementById('emptyDevicesState'),
  // Workspaces page
  workspacesList: document.getElementById('workspacesList'),
  saveWorkspaceBtn: document.getElementById('saveWorkspaceBtn'),
  addWorkspaceRow: document.getElementById('addWorkspaceRow'),
  emptyWorkspacesState: document.getElementById('emptyWorkspacesState'),
  // History page
  historySearchInput: document.getElementById('historySearchInput'),
  sessionHistoryList: document.getElementById('sessionHistoryList'),
  emptyHistoryState: document.getElementById('emptyHistoryState'),
  // Theme and user
  themeBtn: document.getElementById('themeBtn'),
  themeIcon: document.getElementById('themeIcon'),
  userMenu: document.getElementById('userMenu'),
  userAvatar: document.getElementById('userAvatar'),
  userMenuBtn: document.getElementById('userMenuBtn'),
  userDropdown: document.getElementById('userDropdown'),
  userDropdownAvatar: document.getElementById('userDropdownAvatar'),
  userDropdownName: document.getElementById('userDropdownName'),
  userDropdownEmail: document.getElementById('userDropdownEmail'),
  signOutBtn: document.getElementById('signOutBtn'),
  // Modals
  saveWorkspaceModal: document.getElementById('saveWorkspaceModal'),
  closeSaveWorkspaceModal: document.getElementById('closeSaveWorkspaceModal'),
  workspaceName: document.getElementById('workspaceName'),
  workspaceColorPicker: document.getElementById('workspaceColorPicker'),
  workspaceTabList: document.getElementById('workspaceTabList'),
  workspaceTabCount: document.getElementById('workspaceTabCount'),
  selectAllTabs: document.getElementById('selectAllTabs'),
  customUrlInput: document.getElementById('customUrlInput'),
  addCustomUrlBtn: document.getElementById('addCustomUrlBtn'),
  cancelSaveWorkspace: document.getElementById('cancelSaveWorkspace'),
  confirmSaveWorkspace: document.getElementById('confirmSaveWorkspace'),
  shareModal: document.getElementById('shareModal'),
  closeShareModal: document.getElementById('closeShareModal'),
  shareTitle: document.getElementById('shareTitle'),
  shareExpiration: document.getElementById('shareExpiration'),
  shareTabCount: document.getElementById('shareTabCount'),
  cancelShare: document.getElementById('cancelShare'),
  confirmShare: document.getElementById('confirmShare'),
  shareLinkModal: document.getElementById('shareLinkModal'),
  closeShareLinkModal: document.getElementById('closeShareLinkModal'),
  shareLinkUrl: document.getElementById('shareLinkUrl'),
  copyShareLink: document.getElementById('copyShareLink'),
  shareLinkCopied: document.getElementById('shareLinkCopied'),
  closeShareLinkBtn: document.getElementById('closeShareLinkBtn'),
  restoreWorkspaceModal: document.getElementById('restoreWorkspaceModal'),
  closeRestoreWorkspaceModal: document.getElementById('closeRestoreWorkspaceModal'),
  restoreWorkspaceName: document.getElementById('restoreWorkspaceName'),
  restoreAdd: document.getElementById('restoreAdd'),
  restoreReplace: document.getElementById('restoreReplace'),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved preferences
  await loadPreferences();
  
  // Quick load cached user for instant UI (before full auth init)
  const cached = await chrome.storage.local.get(['user', 'remoteTabs']);
  if (cached.user) {
    state.user = cached.user;
    if (cached.remoteTabs) {
      state.remoteTabs = cached.remoteTabs;
    }
  }
  // Always update auth UI to show correct screen
  updateAuthUI();
  
  // Only load tabs if logged in
  if (state.user) {
    // Load tab creation times from background
    await loadTabCreationTimes();
    
    // Initial load
    await loadTabs();
    await loadRecentlyClosed();
    
    // Load workspaces and tab history
    await loadWorkspaces();
    await loadTabHistory();
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize authentication (will refresh tokens in background)
  onAuthStateChanged(handleAuthStateChanged);
  initAuth(); // Don't await - let it run in background
  
  // Focus search input if logged in
  if (state.user) {
    elements.searchInput.focus();
  }
});

/**
 * Handle authentication state changes
 */
let initialAuthHandled = false;
async function handleAuthStateChanged(user) {
  // Skip first null callback if we already have cached user
  if (!initialAuthHandled && !user && state.user) {
    initialAuthHandled = true;
    return;
  }
  initialAuthHandled = true;
  
  const wasLoggedOut = !state.user;
  state.user = user;
  updateAuthUI();
  
  if (user) {
    // If just logged in, load tabs
    if (wasLoggedOut) {
      await loadTabCreationTimes();
      await loadTabs();
      await loadRecentlyClosed();
      await loadWorkspaces();
      await loadTabHistory();
      elements.searchInput.focus();
    }
    // Subscribe to remote tabs
    onRemoteTabsChanged(handleRemoteTabsChanged);
    // Fetch remote tabs immediately
    getRemoteTabs();
    // Sync workspaces with cloud
    syncWorkspaces();
  } else {
    state.remoteTabs = {};
    state.workspaces = [];
    state.tabHistory = [];
    renderOtherDevices();
    renderWorkspaces();
    renderHistoryPage();
  }
}

/**
 * Handle remote tabs updates
 */
function handleRemoteTabsChanged(remoteTabs) {
  state.remoteTabs = remoteTabs;
  renderOtherDevices();
}

/**
 * Update authentication UI based on state
 */
function updateAuthUI() {
  if (state.user) {
    // Show app content, hide login screen
    elements.loginScreen.style.display = 'none';
    elements.appContent.style.display = 'flex';
    
    // Set avatar (with fallback)
    const avatarUrl = state.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.displayName || 'U')}&background=007aff&color=fff`;
    elements.userAvatar.src = avatarUrl;
    elements.userDropdownAvatar.src = avatarUrl;
    elements.userDropdownName.textContent = state.user.displayName || 'User';
    elements.userDropdownEmail.textContent = state.user.email || '';
  } else {
    // Show login screen, hide app content
    elements.loginScreen.style.display = 'flex';
    elements.appContent.style.display = 'none';
    elements.userDropdown.style.display = 'none';
  }
}

async function loadPreferences() {
  try {
    const result = await chrome.storage.local.get(['expandedDomains', 'expandedDevices', 'recentlyClosedExpanded', 'otherDevicesExpanded', 'theme']);
    if (result.expandedDomains) state.expandedDomains = new Set(result.expandedDomains);
    if (result.expandedDevices) state.expandedDevices = new Set(result.expandedDevices);
    if (typeof result.recentlyClosedExpanded === 'boolean') state.recentlyClosedExpanded = result.recentlyClosedExpanded;
    if (typeof result.otherDevicesExpanded === 'boolean') state.otherDevicesExpanded = result.otherDevicesExpanded;
    if (result.theme) state.theme = result.theme;
    
    applyTheme();
    updateToolbarState();
  } catch (error) {
    console.error('Failed to load preferences:', error);
  }
}

async function savePreferences() {
  try {
    await chrome.storage.local.set({
      expandedDomains: Array.from(state.expandedDomains),
      expandedDevices: Array.from(state.expandedDevices),
      recentlyClosedExpanded: state.recentlyClosedExpanded,
      otherDevicesExpanded: state.otherDevicesExpanded,
      theme: state.theme,
    });
  } catch (error) {
    console.error('Failed to save preferences:', error);
  }
}

async function loadTabCreationTimes() {
  try {
    const result = await chrome.storage.local.get('tabCreationTimes');
    state.tabCreationTimes = result.tabCreationTimes || {};
  } catch (error) {
    console.error('Failed to load tab creation times:', error);
  }
}

// ============================================================================
// TAB LOADING
// ============================================================================

async function loadTabs() {
  try {
    elements.loadingState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    
    const tabs = await chrome.tabs.query({});
    
    // Enrich tabs with creation time and last accessed time
    state.tabs = tabs.map(tab => ({
      ...tab,
      domain: getDomain(tab.url),
      openedAt: state.tabCreationTimes[tab.id] || Date.now(),
      lastAccessed: tab.lastAccessed || Date.now(),
    }));
    
    // Update status
    elements.statusIndicator.classList.add('connected');
    elements.statusText.textContent = 'Connected';
    
    // Apply filters and render
    applyFilters();
    
  } catch (error) {
    console.error('Failed to load tabs:', error);
    elements.statusText.textContent = 'Error loading tabs';
  } finally {
    elements.loadingState.style.display = 'none';
  }
}

// ============================================================================
// RECENTLY CLOSED TABS
// ============================================================================

async function loadRecentlyClosed() {
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    
    state.recentlyClosed = sessions
      .filter(session => session.tab) // Only tabs, not windows
      .map(session => ({
        ...session.tab,
        sessionId: session.tab.sessionId,
        closedAt: session.lastModified * 1000,
        domain: getDomain(session.tab.url),
      }))
      .filter(tab => tab.closedAt >= thirtyMinutesAgo); // Only last 30 minutes
    
    renderRecentlyClosed();
  } catch (error) {
    console.error('Failed to load recently closed tabs:', error);
  }
}

function renderRecentlyClosed() {
  const filtered = state.searchQuery
    ? state.recentlyClosed.filter(tab => matchesSearch(tab, state.searchQuery))
    : state.recentlyClosed;
  
  if (filtered.length === 0) {
    elements.recentlyClosedSection.style.display = 'none';
    return;
  }
  
  // When searching, auto-expand the section
  const isExpanded = state.searchQuery ? true : state.recentlyClosedExpanded;
  
  elements.recentlyClosedSection.style.display = 'block';
  elements.recentlyClosedSection.classList.toggle('expanded', isExpanded);
  elements.recentlyClosedHeader.classList.toggle('expanded', isExpanded);
  
  // Show filtered count vs total when searching
  const countDisplay = state.searchQuery 
    ? `(${filtered.length}/${state.recentlyClosed.length})`
    : `(${filtered.length})`;
  elements.recentlyClosedCount.textContent = countDisplay;
  
  elements.recentlyClosedList.innerHTML = filtered.map(tab => `
    <div class="recently-closed-item" data-session-id="${tab.sessionId}">
      ${tab.favIconUrl 
        ? `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.outerHTML='<svg class=\\'tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
        : `<svg class="tab-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
      }
      <div class="recently-closed-info">
        <div class="recently-closed-title">${escapeHtml(tab.title || tab.domain)}</div>
        <div class="recently-closed-meta">
          <span>${tab.domain}</span>
          <span class="tab-meta-separator">•</span>
          <span>${getRelativeTime(tab.closedAt)}</span>
        </div>
      </div>
      <button class="reopen-btn" title="Reopen tab">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2V3z"/>
          <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
        </svg>
        Reopen
      </button>
    </div>
  `).join('');
  
  // Add click handlers
  elements.recentlyClosedList.querySelectorAll('.recently-closed-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.reopen-btn')) {
        reopenTab(item.dataset.sessionId);
      }
    });
    
    item.querySelector('.reopen-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      reopenTab(item.dataset.sessionId);
    });
  });
}

async function reopenTab(sessionId) {
  try {
    await chrome.sessions.restore(sessionId);
    await loadRecentlyClosed();
    window.close();
  } catch (error) {
    console.error('Failed to reopen tab:', error);
  }
}

// ============================================================================
// FILTERING & SORTING
// ============================================================================

function applyFilters() {
  let filtered = [...state.tabs];
  
  // Apply search filter
  if (state.searchQuery) {
    filtered = filtered.filter(tab => matchesSearch(tab, state.searchQuery));
  }
  
  // Apply sorting
  filtered = sortTabs(filtered);
  
  state.filteredTabs = filtered;
  
  // Update counts
  updateCounts();
  
  // Render
  render();
}

function matchesSearch(tab, query) {
  const q = query.toLowerCase();
  const titleMatch = tab.title && tab.title.toLowerCase().includes(q);
  const urlMatch = tab.url && tab.url.toLowerCase().includes(q);
  const domainMatch = tab.domain && tab.domain.toLowerCase().includes(q);
  
  // Debug: uncomment to see what's matching
  // if (titleMatch || urlMatch || domainMatch) {
  //   console.log('[Search] Match:', { query: q, title: tab.title, url: tab.url, domain: tab.domain, titleMatch, urlMatch, domainMatch });
  // }
  
  return titleMatch || urlMatch || domainMatch;
}

function sortTabs(tabs) {
  return [...tabs].sort((a, b) => {
    // Sort by last accessed time (most recently used first)
    const timeA = a.lastAccessed || 0;
    const timeB = b.lastAccessed || 0;
    return timeB - timeA;
  });
}

// ============================================================================
// RENDERING
// ============================================================================

function render() {
  if (state.filteredTabs.length === 0) {
    elements.tabList.innerHTML = '';
  } else {
    if (state.groupByDomain) {
      renderGrouped();
    } else {
      renderFlat();
    }
  }
  
  // Render recently closed (only on Tabs page)
  renderRecentlyClosed();
  
  // Show empty state only if no results
  const hasRecentlyClosed = elements.recentlyClosedSection && 
    elements.recentlyClosedSection.style.display !== 'none';
  const hasAnyResults = state.filteredTabs.length > 0 || hasRecentlyClosed;
  
  elements.emptyState.style.display = hasAnyResults ? 'none' : 'flex';
}

// ============================================================================
// OTHER DEVICES
// ============================================================================

function renderOtherDevices() {
  // This function is now deprecated - devices are shown on a separate page
  // Re-render devices page if currently on it
  if (state.currentPage === 'devices') {
    renderDevicesPage();
  }
}

function renderDeviceTabItem(tab, deviceId) {
  return `
    <div class="device-tab-item" data-url="${escapeHtml(tab.url)}" data-device-id="${deviceId}">
      ${tab.favIconUrl 
        ? `<img class="device-tab-favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.outerHTML='<svg class=\\'device-tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
        : `<svg class="device-tab-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
      }
      <div class="device-tab-info">
        <div class="device-tab-title">${escapeHtml(truncateTitle(tab.title || 'Untitled', 50))}</div>
        <div class="device-tab-url">${escapeHtml(getDomain(tab.url))}</div>
      </div>
      <button class="open-tab-btn" title="Open in this browser">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
          <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
        </svg>
        Open
      </button>
    </div>
  `;
}

function attachDeviceEventListeners() {
  // Device header click (expand/collapse)
  document.querySelectorAll('.device-header').forEach(header => {
    header.addEventListener('click', () => {
      const deviceId = header.closest('.device-group').dataset.deviceId;
      toggleDevice(deviceId);
    });
  });
  
  // Device tab item click (open in current browser)
  document.querySelectorAll('.device-tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.open-tab-btn')) {
        openRemoteTab(item.dataset.url);
      }
    });
    
    const openBtn = item.querySelector('.open-tab-btn');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRemoteTab(item.dataset.url);
      });
    }
  });
}

function toggleDevice(deviceId) {
  if (state.expandedDevices.has(deviceId)) {
    state.expandedDevices.delete(deviceId);
  } else {
    state.expandedDevices.add(deviceId);
  }
  savePreferences();
  renderOtherDevices();
}

function toggleOtherDevices() {
  state.otherDevicesExpanded = !state.otherDevicesExpanded;
  elements.otherDevicesSection.classList.toggle('expanded', state.otherDevicesExpanded);
  elements.otherDevicesHeader.classList.toggle('expanded', state.otherDevicesExpanded);
  savePreferences();
}

async function openRemoteTab(url) {
  try {
    await chrome.tabs.create({ url, active: true });
    window.close();
  } catch (error) {
    console.error('Failed to open remote tab:', error);
  }
}

function renderFlat() {
  elements.tabList.innerHTML = state.filteredTabs.map((tab, index) => 
    renderTabItem(tab, index)
  ).join('');
  
  attachTabEventListeners();
}

function renderGrouped() {
  // Group tabs by domain
  const groups = {};
  const singleTabs = [];
  
  state.filteredTabs.forEach(tab => {
    if (!groups[tab.domain]) {
      groups[tab.domain] = [];
    }
    groups[tab.domain].push(tab);
  });
  
  // Separate groups with 2+ tabs and single tabs
  const domainGroups = [];
  Object.entries(groups).forEach(([domain, tabs]) => {
    if (tabs.length >= 2) {
      domainGroups.push({ domain, tabs });
    } else {
      singleTabs.push(...tabs);
    }
  });
  
  // Sort domain groups by most recently accessed tab
  domainGroups.sort((a, b) => {
    const timeA = Math.max(...a.tabs.map(t => t.lastAccessed || 0));
    const timeB = Math.max(...b.tabs.map(t => t.lastAccessed || 0));
    return timeB - timeA;
  });
  
  // Sort single tabs
  const sortedSingleTabs = sortTabs(singleTabs);
  
  // Build HTML
  let html = '';
  let itemIndex = 0;
  
  domainGroups.forEach(group => {
    const isExpanded = state.expandedDomains.has(group.domain);
    const favicon = group.tabs.find(t => t.favIconUrl)?.favIconUrl;
    const hasActive = group.tabs.some(t => t.active);
    
    html += `
      <div class="domain-group ${isExpanded ? 'expanded' : ''}" data-domain="${escapeHtml(group.domain)}">
        <div class="domain-header ${isExpanded ? 'expanded' : ''}" data-index="${itemIndex}">
          <svg class="domain-chevron" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
          </svg>
          ${hasActive ? '<span class="tab-indicator active"></span>' : ''}
          ${favicon 
            ? `<img class="domain-favicon" src="${escapeHtml(favicon)}" onerror="this.outerHTML='<svg class=\\'domain-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
            : `<svg class="domain-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
          }
          <span class="domain-name">${escapeHtml(group.domain)}</span>
          <span class="domain-count">${group.tabs.length}</span>
          <button class="domain-close-all" title="Close all tabs from ${escapeHtml(group.domain)}">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
            Close All
          </button>
        </div>
        <div class="domain-tabs">
          ${group.tabs.map(tab => renderTabItem(tab, ++itemIndex, true)).join('')}
        </div>
      </div>
    `;
    itemIndex++;
  });
  
  // Single tabs
  sortedSingleTabs.forEach(tab => {
    html += renderTabItem(tab, itemIndex++);
  });
  
  elements.tabList.innerHTML = html;
  
  attachTabEventListeners();
  attachDomainEventListeners();
}

function renderTabItem(tab, index, inGroup = false) {
  return `
    <div class="tab-item ${tab.active ? 'active-tab' : ''}" data-tab-id="${tab.id}" data-index="${index}">
      ${tab.favIconUrl 
        ? `<img class="tab-favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.outerHTML='<svg class=\\'tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
        : `<svg class="tab-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
      }
      <div class="tab-info">
        <div class="tab-title-row">
          ${tab.pinned ? '<span class="tab-indicator pinned" title="Pinned"></span>' : ''}
          ${tab.active ? '<span class="tab-indicator active"></span>' : ''}
          <span class="tab-title">${escapeHtml(truncateTitle(tab.title || 'Untitled'))}</span>
        </div>
        <div class="tab-meta">
          <span class="tab-domain">${escapeHtml(tab.domain)}</span>
        </div>
      </div>
      <button class="tab-close" title="Close tab">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
  `;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Search
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.clearSearch.classList.toggle('visible', state.searchQuery.length > 0);
    applyFilters();
  });
  
  elements.clearSearch.addEventListener('click', () => {
    state.searchQuery = '';
    elements.searchInput.value = '';
    elements.clearSearch.classList.remove('visible');
    elements.searchInput.focus();
    applyFilters();
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', handleKeyDown);
  
  // Recently closed header toggle (only on Tabs page)
  if (elements.recentlyClosedHeader) {
    elements.recentlyClosedHeader.addEventListener('click', () => {
      toggleRecentlyClosed();
    });
  }
  
  // Theme toggle
  elements.themeBtn.addEventListener('click', () => {
    toggleTheme();
  });
  
  // Login button - delegate to background script
  elements.loginBtn.addEventListener('click', async () => {
    try {
      elements.loginBtn.disabled = true;
      elements.loginBtn.innerHTML = `
        <div class="btn-spinner"></div>
        Signing in...
      `;
      
      // Send message to background to handle sign in
      // This way auth continues even if popup closes
      const response = await chrome.runtime.sendMessage({ action: 'signIn' });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Refresh auth state
      await initAuth();
      
    } catch (error) {
      console.error('Sign in failed:', error);
      alert('Sign in failed. Please try again.');
      
      elements.loginBtn.disabled = false;
      elements.loginBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      `;
    }
  });
  
  // User menu toggle
  elements.userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = elements.userDropdown.style.display === 'block';
    elements.userDropdown.style.display = isVisible ? 'none' : 'block';
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu') && !e.target.closest('.user-dropdown')) {
      elements.userDropdown.style.display = 'none';
    }
  });
  
  // Sign out button - delegate to background script
  elements.signOutBtn.addEventListener('click', async () => {
    try {
      // Show loading state
      elements.signOutBtn.disabled = true;
      elements.signOutBtn.innerHTML = `
        <div class="btn-spinner"></div>
        Signing out...
      `;
      
      // Send message to background to handle sign out
      await chrome.runtime.sendMessage({ action: 'signOut' });
      
      // Clear local state immediately
      state.user = null;
      state.remoteTabs = {};
      
      // Update UI
      updateAuthUI();
      renderOtherDevices();
      elements.userDropdown.style.display = 'none';
      
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      // Reset button state
      elements.signOutBtn.disabled = false;
      elements.signOutBtn.innerHTML = `
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
          <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
        </svg>
        Sign out
      `;
    }
  });
  
  // Event delegation for Other Devices page
  elements.otherDevicesList.addEventListener('click', (e) => {
    // Device header click (expand/collapse)
    const header = e.target.closest('.device-header');
    if (header) {
      const group = header.closest('.device-group');
      const isExpanded = group.classList.contains('expanded');
      group.classList.toggle('expanded', !isExpanded);
      header.classList.toggle('expanded', !isExpanded);
      const tabs = group.querySelector('.device-tabs');
      tabs.style.display = isExpanded ? 'none' : 'block';
      return;
    }
    
    // Device tab item click (open tab)
    const tabItem = e.target.closest('.device-tab-item');
    if (tabItem) {
      const url = tabItem.dataset.url;
      if (url) {
        openRemoteTab(url);
      }
    }
  });
}

function attachTabEventListeners() {
  document.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-close')) {
        activateTab(parseInt(item.dataset.tabId));
      }
    });
    
    const closeBtn = item.querySelector('.tab-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(parseInt(item.dataset.tabId));
      });
    }
  });
}

function attachDomainEventListeners() {
  document.querySelectorAll('.domain-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (!e.target.closest('.domain-close-all')) {
        const domain = header.closest('.domain-group').dataset.domain;
        toggleDomain(domain);
      }
    });
    
    const closeAllBtn = header.querySelector('.domain-close-all');
    if (closeAllBtn) {
      closeAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const domain = header.closest('.domain-group').dataset.domain;
        closeAllTabsInDomain(domain);
      });
    }
  });
}

// ============================================================================
// TAB ACTIONS
// ============================================================================

async function activateTab(tabId) {
  try {
    // Send to background script to handle tab activation
    // This ensures the tab is activated even if popup closes
    chrome.runtime.sendMessage({ action: 'activateTab', tabId });
    setTimeout(() => window.close(), 50);
  } catch (error) {
    console.error('Failed to activate tab:', error);
  }
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
    state.tabs = state.tabs.filter(t => t.id !== tabId);
    applyFilters();
    await loadRecentlyClosed();
  } catch (error) {
    console.error('Failed to close tab:', error);
  }
}

async function closeAllTabsInDomain(domain) {
  try {
    const tabIds = state.tabs.filter(t => t.domain === domain).map(t => t.id);
    await chrome.tabs.remove(tabIds);
    state.tabs = state.tabs.filter(t => t.domain !== domain);
    state.expandedDomains.delete(domain);
    applyFilters();
    await loadRecentlyClosed();
  } catch (error) {
    console.error('Failed to close tabs:', error);
  }
}

function toggleDomain(domain) {
  if (state.expandedDomains.has(domain)) {
    state.expandedDomains.delete(domain);
  } else {
    state.expandedDomains.add(domain);
  }
  savePreferences();
  render();
}

function toggleRecentlyClosed() {
  state.recentlyClosedExpanded = !state.recentlyClosedExpanded;
  elements.recentlyClosedSection.classList.toggle('expanded', state.recentlyClosedExpanded);
  elements.recentlyClosedHeader.classList.toggle('expanded', state.recentlyClosedExpanded);
  savePreferences();
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

function handleKeyDown(e) {
  const selectableItems = getSelectableItems();
  
  // Handle 'C' key for closing tabs (works with any input language)
  if (e.code === 'KeyC' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (state.selectedIndex >= 0 && document.activeElement !== elements.searchInput) {
      e.preventDefault();
      const item = selectableItems[state.selectedIndex];
      if (item.dataset.tabId) {
        closeTab(parseInt(item.dataset.tabId));
      }
      return;
    }
  }
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (state.selectedIndex < selectableItems.length - 1) {
        state.selectedIndex++;
        updateSelection(selectableItems);
        // Remove focus from search input when navigating list
        if (state.selectedIndex >= 0) {
          elements.searchInput.blur();
        }
      } else if (state.selectedIndex === selectableItems.length - 1) {
        // At last item, go back to search input
        state.selectedIndex = -1;
        elements.searchInput.focus();
        updateSelection(selectableItems);
      }
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      if (state.selectedIndex > 0) {
        state.selectedIndex--;
        updateSelection(selectableItems);
      } else if (state.selectedIndex === 0) {
        // At first item, go to search input
        state.selectedIndex = -1;
        elements.searchInput.focus();
        updateSelection(selectableItems);
      } else if (state.selectedIndex === -1 && selectableItems.length > 0) {
        // At search input, go to last item
        state.selectedIndex = selectableItems.length - 1;
        elements.searchInput.blur();
        updateSelection(selectableItems);
      }
      break;
      
    case 'Enter':
      if (state.selectedIndex >= 0 && selectableItems[state.selectedIndex]) {
        e.preventDefault();
        const item = selectableItems[state.selectedIndex];
        if (item.dataset.tabId) {
          activateTab(parseInt(item.dataset.tabId));
        } else if (item.dataset.sessionId) {
          reopenTab(item.dataset.sessionId);
        } else if (item.classList.contains('domain-header')) {
          const domain = item.closest('.domain-group').dataset.domain;
          toggleDomain(domain);
        } else if (item.classList.contains('device-header')) {
          const deviceGroup = item.closest('.device-group');
          if (deviceGroup) {
            const isExpanded = deviceGroup.classList.contains('expanded');
            deviceGroup.classList.toggle('expanded', !isExpanded);
            item.classList.toggle('expanded', !isExpanded);
            const tabs = deviceGroup.querySelector('.device-tabs');
            if (tabs) {
              tabs.style.display = isExpanded ? 'none' : 'block';
            }
          }
        } else if (item.classList.contains('device-tab-item')) {
          const url = item.dataset.url;
          if (url) {
            openRemoteTab(url);
          }
        } else if (item.classList.contains('workspace-header')) {
          const workspaceGroup = item.closest('.workspace-group');
          if (workspaceGroup) {
            const isExpanded = workspaceGroup.classList.contains('expanded');
            workspaceGroup.classList.toggle('expanded', !isExpanded);
            item.classList.toggle('expanded', !isExpanded);
            const tabs = workspaceGroup.querySelector('.workspace-tabs');
            if (tabs) {
              tabs.style.display = isExpanded ? 'none' : 'block';
            }
          }
        } else if (item.classList.contains('workspace-tab-item')) {
          const url = item.dataset.url;
          if (url) {
            chrome.tabs.create({ url, active: true });
            window.close();
          }
        } else if (item.classList.contains('section-header')) {
          // Check which section header it is
          const section = item.closest('section');
          if (section && section.id === 'otherDevicesSection') {
            toggleOtherDevices();
          } else {
            toggleRecentlyClosed();
          }
        }
      }
      break;
      
      
    case 'Escape':
      e.preventDefault();
      window.close();
      break;
      
    case 'f':
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        state.selectedIndex = -1;
        elements.searchInput.focus();
        elements.searchInput.select();
        updateSelection(selectableItems);
      }
      break;
  }
}

function getSelectableItems() {
  let items = [];
  
  // Get items based on current page
  if (state.currentPage === 'tabs') {
    items = Array.from(document.querySelectorAll('#pageTabs .tab-item, #pageTabs .domain-header, #pageTabs .section-header, #pageTabs .recently-closed-item'));
  } else if (state.currentPage === 'devices') {
    items = Array.from(document.querySelectorAll('#pageDevices .device-header, #pageDevices .device-tab-item'));
  } else if (state.currentPage === 'workspaces') {
    items = Array.from(document.querySelectorAll('#pageWorkspaces .workspace-header, #pageWorkspaces .workspace-tab-item'));
  } else if (state.currentPage === 'history') {
    items = Array.from(document.querySelectorAll('#pageHistory .session-card'));
  }
  
  return items.filter(item => {
    // If Recently Closed is collapsed, exclude its items
    if (!state.recentlyClosedExpanded && item.classList.contains('recently-closed-item')) {
      return false;
    }
    
    // If device group is collapsed, exclude its tabs
    if (item.classList.contains('device-tab-item')) {
      const deviceGroup = item.closest('.device-group');
      if (deviceGroup && !deviceGroup.classList.contains('expanded')) {
        return false;
      }
    }
    
    // If workspace group is collapsed, exclude its tabs
    if (item.classList.contains('workspace-tab-item')) {
      const workspaceGroup = item.closest('.workspace-group');
      if (workspaceGroup && !workspaceGroup.classList.contains('expanded')) {
        return false;
      }
    }
    
    // If tab is inside a collapsed domain group, exclude it
    if (item.classList.contains('tab-item')) {
      const domainGroup = item.closest('.domain-group');
      if (domainGroup && !domainGroup.classList.contains('expanded')) {
        return false;
      }
    }
    
    return true;
  });
}

function updateSelection(selectableItems) {
  // Remove all selections
  selectableItems.forEach(item => item.classList.remove('selected'));
  
  // Add selection to current item
  if (state.selectedIndex >= 0 && selectableItems[state.selectedIndex]) {
    const item = selectableItems[state.selectedIndex];
    item.classList.add('selected');
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateCounts() {
  // Counts removed from UI
}

function updateToolbarState() {
  // No toolbar buttons to update
}

function applyTheme() {
  const root = document.documentElement;
  root.classList.remove('light-mode', 'dark-mode');
  
  if (state.theme === 'dark') {
    root.classList.add('dark-mode');
  } else {
    root.classList.add('light-mode');
  }
  
  updateThemeIcon();
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  savePreferences();
}

function updateThemeIcon() {
  const sunIcon = '<path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>';
  const moonIcon = '<path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>';
  
  if (state.theme === 'light') {
    elements.themeIcon.innerHTML = sunIcon;
    elements.themeBtn.title = 'Light mode';
  } else {
    elements.themeIcon.innerHTML = moonIcon;
    elements.themeBtn.title = 'Dark mode';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getDomain(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return url ? new URL(url).hostname || 'chrome' : 'unknown';
    }
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function truncateTitle(title, maxLength = 60) {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getFormattedDuration(openedAt) {
  if (!openedAt) return '';
  
  const seconds = Math.floor((Date.now() - openedAt) / 1000);
  
  if (seconds < 60) return '';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getRelativeTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ============================================================================
// WORKSPACES
// ============================================================================

async function loadWorkspaces() {
  await initWorkspaces();
  state.workspaces = getWorkspaces();
  renderWorkspaces();
  
  // Subscribe to changes
  onWorkspacesChanged((workspaces) => {
    state.workspaces = workspaces;
    renderWorkspaces();
  });
}

function renderWorkspaces() {
  // Re-render workspaces page if currently on it
  if (state.currentPage === 'workspaces') {
    renderWorkspacesPage();
  }
}

function showRestoreWorkspaceModal(workspaceId) {
  const workspace = state.workspaces.find(w => w.id === workspaceId);
  if (!workspace) return;
  
  state.selectedWorkspaceId = workspaceId;
  elements.restoreWorkspaceName.textContent = workspace.name;
  elements.restoreWorkspaceModal.style.display = 'flex';
}

function hideRestoreWorkspaceModal() {
  elements.restoreWorkspaceModal.style.display = 'none';
  state.selectedWorkspaceId = null;
}

async function handleRestoreWorkspace() {
  if (!state.selectedWorkspaceId) return;
  
  try {
    await restoreWorkspace(state.selectedWorkspaceId);
    hideRestoreWorkspaceModal();
    window.close();
  } catch (error) {
    console.error('Failed to restore workspace:', error);
    alert('Failed to restore workspace');
  }
}

function showSaveWorkspaceModal() {
  state.editingWorkspaceId = null; // New workspace mode
  
  // Update modal title
  elements.saveWorkspaceModal.querySelector('.modal-title').textContent = 'Save Workspace';
  elements.confirmSaveWorkspace.textContent = 'Save';
  
  elements.workspaceName.value = '';
  elements.customUrlInput.value = '';
  state.selectedTabs = new Set(state.tabs.map(t => t.id)); // Select all by default
  state.selectedColor = 'blue'; // Reset to default color
  state.customTabs = []; // Reset custom tabs
  
  // Reset color picker selection
  elements.workspaceColorPicker.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.color === 'blue');
  });
  
  // Render tab selection list
  renderWorkspaceTabList();
  updateWorkspaceTabCount();
  
  elements.saveWorkspaceModal.style.display = 'flex';
  elements.workspaceName.focus();
}

function showEditWorkspaceModal(workspaceId) {
  const workspace = state.workspaces.find(w => w.id === workspaceId);
  if (!workspace) return;
  
  state.editingWorkspaceId = workspaceId; // Edit mode
  
  // Update modal title
  elements.saveWorkspaceModal.querySelector('.modal-title').textContent = 'Edit Workspace';
  elements.confirmSaveWorkspace.textContent = 'Update';
  
  elements.workspaceName.value = workspace.name;
  elements.customUrlInput.value = '';
  state.selectedColor = workspace.color || 'blue';
  
  // Convert workspace tabs to customTabs (since they're not currently open)
  state.customTabs = workspace.tabs.map((tab, index) => ({
    id: 'existing-' + index,
    url: tab.url,
    title: tab.title || getDomain(tab.url),
    favIconUrl: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${getDomain(tab.url)}&sz=32`,
    isCustom: true
  }));
  
  // Select all existing tabs
  state.selectedTabs = new Set(state.customTabs.map(t => t.id));
  
  // Update color picker selection
  elements.workspaceColorPicker.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.color === state.selectedColor);
  });
  
  // Render tab selection list (only customTabs, no current tabs)
  renderEditWorkspaceTabList();
  updateWorkspaceTabCount();
  
  elements.saveWorkspaceModal.style.display = 'flex';
  elements.workspaceName.focus();
}

function renderEditWorkspaceTabList() {
  // In edit mode, show customTabs (existing workspace tabs) + option to add from current tabs
  const allTabs = [...state.customTabs];
  
  // Add current open tabs that aren't already in the workspace
  const existingUrls = new Set(state.customTabs.map(t => t.url));
  state.tabs.forEach(tab => {
    if (!existingUrls.has(tab.url)) {
      allTabs.push({
        ...tab,
        isCurrentTab: true
      });
    }
  });
  
  elements.workspaceTabList.innerHTML = allTabs.map(tab => {
    const domain = getDomain(tab.url);
    const isCustom = tab.isCustom;
    const isCurrentTab = tab.isCurrentTab;
    return `
      <label class="tab-select-item ${isCustom ? 'custom-tab' : ''} ${isCurrentTab ? 'current-tab' : ''}">
        <input type="checkbox" data-tab-id="${tab.id}" ${state.selectedTabs.has(tab.id) ? 'checked' : ''}>
        ${tab.favIconUrl 
          ? `<img src="${escapeHtml(tab.favIconUrl)}" class="tab-favicon" onerror="this.outerHTML='<svg class=\\'tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
          : `<svg class="tab-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
        }
        <div class="tab-info">
          <span class="tab-title">${escapeHtml(tab.title || 'Untitled')}</span>
          <span class="tab-url">${escapeHtml(domain)}</span>
        </div>
        ${isCustom ? `<button class="remove-custom-tab" data-custom-id="${tab.id}" title="Remove">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>` : ''}
      </label>
    `;
  }).join('');
  
  // Add event listeners for remove buttons
  elements.workspaceTabList.querySelectorAll('.remove-custom-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const customId = btn.dataset.customId;
      state.customTabs = state.customTabs.filter(t => t.id !== customId);
      state.selectedTabs.delete(customId);
      renderEditWorkspaceTabList();
      updateWorkspaceTabCount();
    });
  });
}

function addCustomUrl() {
  let url = elements.customUrlInput.value.trim();
  if (!url) return;
  
  // Add https:// if no protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    alert('Please enter a valid URL');
    return;
  }
  
  // Generate a unique ID for custom tab
  const customId = 'custom-' + Date.now();
  const domain = getDomain(url);
  
  state.customTabs.push({
    id: customId,
    url: url,
    title: domain,
    favIconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    isCustom: true
  });
  
  state.selectedTabs.add(customId);
  
  elements.customUrlInput.value = '';
  if (state.editingWorkspaceId) {
    renderEditWorkspaceTabList();
  } else {
    renderWorkspaceTabList();
  }
  updateWorkspaceTabCount();
}

function renderWorkspaceTabList() {
  const allTabs = [...state.customTabs, ...state.tabs];
  
  elements.workspaceTabList.innerHTML = allTabs.map(tab => {
    const domain = getDomain(tab.url);
    const isCustom = tab.isCustom;
    return `
      <label class="tab-select-item ${isCustom ? 'custom-tab' : ''}">
        <input type="checkbox" data-tab-id="${tab.id}" ${state.selectedTabs.has(tab.id) ? 'checked' : ''}>
        ${tab.favIconUrl 
          ? `<img src="${escapeHtml(tab.favIconUrl)}" class="tab-favicon" onerror="this.outerHTML='<svg class=\\'tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
          : `<svg class="tab-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
        }
        <div class="tab-info">
          <span class="tab-title">${escapeHtml(tab.title || 'Untitled')}</span>
          <span class="tab-url">${escapeHtml(domain)}</span>
        </div>
        ${isCustom ? `<button class="remove-custom-tab" data-custom-id="${tab.id}" title="Remove">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>` : ''}
      </label>
    `;
  }).join('');
  
  // Add event listeners for remove buttons
  elements.workspaceTabList.querySelectorAll('.remove-custom-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const customId = btn.dataset.customId;
      state.customTabs = state.customTabs.filter(t => t.id !== customId);
      state.selectedTabs.delete(customId);
      renderWorkspaceTabList();
      updateWorkspaceTabCount();
    });
  });
}

function updateWorkspaceTabCount() {
  elements.workspaceTabCount.textContent = state.selectedTabs.size;
  const totalTabs = state.tabs.length + state.customTabs.length;
  elements.selectAllTabs.textContent = state.selectedTabs.size === totalTabs ? 'Deselect All' : 'Select All';
}

function toggleAllTabsSelection() {
  if (state.editingWorkspaceId) {
    // Edit mode: include customTabs and current tabs not in workspace
    const existingUrls = new Set(state.customTabs.map(t => t.url));
    const currentTabsNotInWorkspace = state.tabs.filter(t => !existingUrls.has(t.url));
    const allTabs = [...state.customTabs, ...currentTabsNotInWorkspace];
    
    if (state.selectedTabs.size === allTabs.length) {
      state.selectedTabs.clear();
    } else {
      state.selectedTabs = new Set(allTabs.map(t => t.id));
    }
    renderEditWorkspaceTabList();
  } else {
    // New workspace mode
    const allTabs = [...state.customTabs, ...state.tabs];
    if (state.selectedTabs.size === allTabs.length) {
      state.selectedTabs.clear();
    } else {
      state.selectedTabs = new Set(allTabs.map(t => t.id));
    }
    renderWorkspaceTabList();
  }
  updateWorkspaceTabCount();
}

function handleTabSelectionChange(e) {
  const checkbox = e.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  
  const rawId = checkbox.dataset.tabId;
  // Custom tabs have string IDs like 'custom-123' or 'existing-0', regular tabs have numeric IDs
  const tabId = (rawId.startsWith('custom-') || rawId.startsWith('existing-')) ? rawId : parseInt(rawId);
  if (checkbox.checked) {
    state.selectedTabs.add(tabId);
  } else {
    state.selectedTabs.delete(tabId);
  }
  updateWorkspaceTabCount();
}

function hideSaveWorkspaceModal() {
  elements.saveWorkspaceModal.style.display = 'none';
}

async function handleSaveWorkspace() {
  const name = elements.workspaceName.value.trim() || `Workspace ${state.workspaces.length + 1}`;
  const color = state.selectedColor;
  
  // Include both regular tabs and custom tabs
  const selectedRegularTabs = state.tabs.filter(t => state.selectedTabs.has(t.id));
  const selectedCustomTabs = state.customTabs.filter(t => state.selectedTabs.has(t.id));
  const selectedTabObjects = [...selectedCustomTabs, ...selectedRegularTabs];
  
  if (selectedTabObjects.length === 0) {
    alert('Please select at least one tab');
    return;
  }
  
  // Format tabs for storage
  const tabsToSave = selectedTabObjects.map(tab => ({
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    pinned: tab.pinned || false,
  }));
  
  try {
    if (state.editingWorkspaceId) {
      // Update existing workspace
      await updateWorkspace(state.editingWorkspaceId, {
        name,
        color,
        tabs: tabsToSave
      });
      console.log('[Workspace] Updated:', state.editingWorkspaceId);
    } else {
      // Create new workspace
      const workspace = await createWorkspace(name, selectedTabObjects, color);
      console.log('[Workspace] Created:', workspace);
    }
    
    // Update local state with latest workspaces
    state.workspaces = getWorkspaces();
    
    hideSaveWorkspaceModal();
    
    // Render workspaces page
    renderWorkspaces();
  } catch (error) {
    console.error('Failed to save workspace:', error);
    alert('Failed to save workspace');
  }
}

// ============================================================================
// SESSION HISTORY
// ============================================================================

async function loadTabHistory() {
  // Use browser's built-in history API
  renderHistoryPage();
}


// ============================================================================
// TAB SHARING
// ============================================================================

function showShareModal() {
  // Share all current tabs
  elements.shareTitle.value = '';
  elements.shareExpiration.value = '7_days';
  elements.shareTabCount.textContent = state.tabs.length;
  elements.shareModal.style.display = 'flex';
}

function hideShareModal() {
  elements.shareModal.style.display = 'none';
}

async function handleCreateShare() {
  const title = elements.shareTitle.value.trim() || undefined;
  const expiration = elements.shareExpiration.value;
  
  try {
    elements.confirmShare.disabled = true;
    elements.confirmShare.textContent = 'Creating...';
    
    const result = await createShareLink(state.tabs, { title, expiration });
    
    hideShareModal();
    showShareLinkModal(result.url);
  } catch (error) {
    console.error('Failed to create share link:', error);
    alert('Failed to create share link: ' + error.message);
  } finally {
    elements.confirmShare.disabled = false;
    elements.confirmShare.textContent = 'Create Link';
  }
}

function showShareLinkModal(url) {
  elements.shareLinkUrl.value = url;
  elements.shareLinkCopied.style.display = 'none';
  elements.shareLinkModal.style.display = 'flex';
}

function hideShareLinkModal() {
  elements.shareLinkModal.style.display = 'none';
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(elements.shareLinkUrl.value);
    elements.shareLinkCopied.style.display = 'block';
    setTimeout(() => {
      elements.shareLinkCopied.style.display = 'none';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy link:', error);
  }
}

// ============================================================================
// NEW SECTION EVENT LISTENERS
// ============================================================================

function initWorkspaceEvents() {
  // Save workspace button (in page header)
  elements.saveWorkspaceBtn.addEventListener('click', showSaveWorkspaceModal);
  
  // Workspace list clicks
  elements.workspacesList.addEventListener('click', handleWorkspaceCardClick);
  
  // Save workspace modal
  elements.closeSaveWorkspaceModal.addEventListener('click', hideSaveWorkspaceModal);
  elements.cancelSaveWorkspace.addEventListener('click', hideSaveWorkspaceModal);
  elements.confirmSaveWorkspace.addEventListener('click', handleSaveWorkspace);
  elements.selectAllTabs.addEventListener('click', toggleAllTabsSelection);
  elements.workspaceTabList.addEventListener('change', handleTabSelectionChange);
  
  // Color picker
  elements.workspaceColorPicker.addEventListener('click', (e) => {
    const colorOption = e.target.closest('.color-option');
    if (colorOption) {
      state.selectedColor = colorOption.dataset.color;
      elements.workspaceColorPicker.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt === colorOption);
      });
    }
  });
  
  // Add custom URL
  elements.addCustomUrlBtn.addEventListener('click', addCustomUrl);
  elements.customUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomUrl();
    }
  });
  
  // Restore workspace modal
  elements.closeRestoreWorkspaceModal.addEventListener('click', hideRestoreWorkspaceModal);
  elements.restoreAdd.addEventListener('click', () => handleRestoreWorkspace('add'));
  elements.restoreReplace.addEventListener('click', () => handleRestoreWorkspace('replace'));
}

function handleWorkspaceCardClick(e) {
  const group = e.target.closest('.workspace-group');
  if (!group) return;
  
  const workspaceId = group.dataset.workspaceId;
  const action = e.target.closest('[data-action]')?.dataset.action;
  
  // Handle action buttons
  if (action === 'delete') {
    e.stopPropagation();
    if (confirm('Delete this workspace?')) {
      deleteWorkspace(workspaceId);
      state.workspaces = getWorkspaces();
      renderWorkspacesPage();
    }
    return;
  } else if (action === 'edit') {
    e.stopPropagation();
    showEditWorkspaceModal(workspaceId);
    return;
  } else if (action === 'restore') {
    e.stopPropagation();
    restoreWorkspace(workspaceId).then(() => window.close());
    return;
  }
  
  // Handle workspace tab item click (open single tab)
  const tabItem = e.target.closest('.workspace-tab-item');
  if (tabItem) {
    const url = tabItem.dataset.url;
    if (url) {
      chrome.tabs.create({ url, active: true });
      window.close();
    }
    return;
  }
  
  // Handle header click (expand/collapse)
  const header = e.target.closest('.workspace-header');
  if (header) {
    const isExpanded = group.classList.contains('expanded');
    group.classList.toggle('expanded', !isExpanded);
    header.classList.toggle('expanded', !isExpanded);
    const tabs = group.querySelector('.workspace-tabs');
    tabs.style.display = isExpanded ? 'none' : 'block';
  }
}

function initSessionHistoryEvents() {
  // History item clicks
  elements.sessionHistoryList.addEventListener('click', handleHistoryItemClick);
  
  // History search
  let historySearchTimeout;
  elements.historySearchInput.addEventListener('input', (e) => {
    clearTimeout(historySearchTimeout);
    historySearchTimeout = setTimeout(() => {
      renderHistoryPage(e.target.value.trim());
    }, 300); // Debounce 300ms
  });
}

function handleHistoryItemClick(e) {
  const item = e.target.closest('.history-item');
  if (!item) return;
  
  const url = item.dataset.url;
  if (url) {
    chrome.tabs.create({ url, active: true });
    window.close();
  }
}

function initShareEvents() {
  // Share modal
  elements.closeShareModal.addEventListener('click', hideShareModal);
  elements.cancelShare.addEventListener('click', hideShareModal);
  elements.confirmShare.addEventListener('click', handleCreateShare);
  
  // Share link modal
  elements.closeShareLinkModal.addEventListener('click', hideShareLinkModal);
  elements.closeShareLinkBtn.addEventListener('click', hideShareLinkModal);
  elements.copyShareLink.addEventListener('click', copyShareLink);
}

// Initialize new events
initWorkspaceEvents();
initSessionHistoryEvents();
initShareEvents();
initNavigationEvents();

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavigationEvents() {
  // Bottom navigation clicks
  elements.bottomNav.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;
    
    const page = navItem.dataset.page;
    if (page) {
      switchPage(page);
    }
  });
}

function switchPage(pageName) {
  state.currentPage = pageName;
  
  // Update navigation active state
  elements.bottomNav.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });
  
  // Hide all pages
  elements.pageTabs.style.display = 'none';
  elements.pageDevices.style.display = 'none';
  elements.pageWorkspaces.style.display = 'none';
  elements.pageHistory.style.display = 'none';
  
  // Show selected page
  switch (pageName) {
    case 'tabs':
      elements.pageTabs.style.display = 'flex';
      elements.toolbar.style.display = 'block';
      elements.searchInput.focus();
      break;
    case 'devices':
      elements.pageDevices.style.display = 'flex';
      elements.toolbar.style.display = 'none';
      renderDevicesPage();
      break;
    case 'workspaces':
      elements.pageWorkspaces.style.display = 'flex';
      elements.toolbar.style.display = 'none';
      renderWorkspacesPage();
      break;
    case 'history':
      elements.pageHistory.style.display = 'flex';
      elements.toolbar.style.display = 'none';
      renderHistoryPage();
      elements.historySearchInput.focus();
      break;
  }
}

function renderDevicesPage() {
  // state.remoteTabs structure: { deviceId: { device: {...}, tabs: [...] } }
  const deviceEntries = Object.entries(state.remoteTabs);
  const devicesWithTabs = deviceEntries.filter(([id, data]) => data.tabs && data.tabs.length > 0);
  
  if (devicesWithTabs.length === 0) {
    elements.otherDevicesList.innerHTML = '';
    elements.emptyDevicesState.style.display = 'flex';
    return;
  }
  
  elements.emptyDevicesState.style.display = 'none';
  
  elements.otherDevicesList.innerHTML = devicesWithTabs.map(([deviceId, data]) => {
    const device = data.device;
    const tabs = data.tabs;
    const lastSeenTime = device.lastSeen ? new Date(device.lastSeen).getTime() : 0;
    const isOnline = Date.now() - lastSeenTime < 2 * 60 * 1000; // 2 minutes (sync interval is 1 min)
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? 'Online' : 'Offline';
    
    return `
      <div class="device-group expanded" data-device-id="${deviceId}">
        <div class="device-header expanded" tabindex="0">
          <svg class="device-chevron" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/>
          </svg>
          <svg class="device-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2z"/>
            <path d="M6 13.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/>
          </svg>
          <span class="device-name">${escapeHtml(device.name)}</span>
          <span class="device-status ${statusClass}"></span>
          <span class="device-tab-count">${tabs.length} tabs</span>
        </div>
        <div class="device-tabs" style="display: block;">
          ${tabs.map(tab => `
            <div class="device-tab-item" data-url="${escapeHtml(tab.url)}" data-device-id="${deviceId}">
              ${tab.favIconUrl 
                ? `<img class="device-tab-favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.outerHTML='<svg class=\\'device-tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
                : `<svg class="device-tab-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
              }
              <div class="device-tab-info">
                <span class="device-tab-title">${escapeHtml(tab.title || 'Untitled')}</span>
                <span class="device-tab-url">${escapeHtml(new URL(tab.url).hostname)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
  
}

function renderWorkspacesPage() {
  const workspaces = state.workspaces;
  
  if (workspaces.length === 0) {
    elements.workspacesList.innerHTML = '';
    elements.emptyWorkspacesState.style.display = 'flex';
    return;
  }
  
  elements.emptyWorkspacesState.style.display = 'none';
  
  elements.workspacesList.innerHTML = workspaces.map(workspace => `
    <div class="workspace-group" data-workspace-id="${workspace.id}">
      <div class="workspace-header" tabindex="0">
        <svg class="workspace-chevron" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/>
        </svg>
        <svg class="workspace-icon color-${workspace.color || 'blue'}" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
        </svg>
        <span class="workspace-name">${escapeHtml(workspace.name)}</span>
        <span class="workspace-tab-count">${workspace.tabs.length} tabs</span>
        <button class="workspace-action-btn" data-action="edit" title="Edit workspace">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
          </svg>
        </button>
        <button class="workspace-action-btn" data-action="restore" title="Open all tabs">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
            <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
          </svg>
        </button>
        <button class="workspace-action-btn" data-action="delete" title="Delete workspace">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </div>
      <div class="workspace-tabs" style="display: none;">
        ${workspace.tabs.map(tab => `
          <div class="workspace-tab-item" data-url="${escapeHtml(tab.url)}">
            ${tab.favIconUrl 
              ? `<img class="workspace-tab-favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.outerHTML='<svg class=\\'workspace-tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">`
              : `<svg class="workspace-tab-favicon default" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/></svg>`
            }
            <div class="workspace-tab-info">
              <span class="workspace-tab-title">${escapeHtml(tab.title || 'Untitled')}</span>
              <span class="workspace-tab-url">${escapeHtml(new URL(tab.url).hostname)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function renderHistoryPage(searchText = '') {
  // Check if history API is available
  if (!chrome.history) {
    elements.sessionHistoryList.innerHTML = '<div class="empty-state"><span>History API not available. Please reload the extension.</span></div>';
    elements.emptyHistoryState.style.display = 'none';
    return;
  }
  
  // Get history from browser API (last 7 days, max 200 items)
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const historyItems = await chrome.history.search({
    text: searchText,
    startTime: oneWeekAgo,
    maxResults: 200
  });
  
  if (historyItems.length === 0) {
    elements.sessionHistoryList.innerHTML = '';
    elements.emptyHistoryState.style.display = 'flex';
    return;
  }
  
  elements.emptyHistoryState.style.display = 'none';
  
  // Group by date
  const historyByDate = {};
  for (const item of historyItems) {
    const date = new Date(item.lastVisitTime).toISOString().split('T')[0];
    if (!historyByDate[date]) {
      historyByDate[date] = [];
    }
    historyByDate[date].push(item);
  }
  
  const dates = Object.keys(historyByDate).sort().reverse();
  
  elements.sessionHistoryList.innerHTML = dates.map(date => `
    <div class="history-date-group">
      <div class="history-date-header">${formatDate(date)}</div>
      ${historyByDate[date].map(item => {
        const domain = getDomain(item.url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        return `
        <div class="history-item" data-url="${escapeHtml(item.url)}">
          <img src="${faviconUrl}" class="tab-favicon" onerror="this.outerHTML='<svg class=\\'tab-favicon default\\' viewBox=\\'0 0 16 16\\' fill=\\'currentColor\\'><path d=\\'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z\\'/></svg>'">
          <div class="history-item-info">
            <span class="history-item-title">${escapeHtml(item.title || domain)}</span>
            <span class="history-item-url">${escapeHtml(domain)}</span>
          </div>
          <span class="history-item-time">${formatTime(new Date(item.lastVisitTime).toISOString())}</span>
        </div>
      `;}).join('')}
    </div>
  `).join('');
}
