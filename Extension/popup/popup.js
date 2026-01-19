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
 */

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
  selectedIndex: -1, // -1 means search input is focused
  tabCreationTimes: {},
  recentlyClosedExpanded: true,
  theme: 'light', // 'light' or 'dark'
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  searchInput: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearch'),
  tabList: document.getElementById('tabList'),
  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  recentlyClosedSection: document.getElementById('recentlyClosedSection'),
  recentlyClosedHeader: document.getElementById('recentlyClosedHeader'),
  recentlyClosedCount: document.getElementById('recentlyClosedCount'),
  recentlyClosedList: document.getElementById('recentlyClosedList'),
  refreshBtn: document.getElementById('refreshBtn'),
  themeBtn: document.getElementById('themeBtn'),
  themeIcon: document.getElementById('themeIcon'),
  expandCollapseBtn: document.getElementById('expandCollapseBtn'),
  expandCollapseIcon: document.getElementById('expandCollapseIcon'),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved preferences
  await loadPreferences();
  
  // Load tab creation times from background
  await loadTabCreationTimes();
  
  // Initial load
  await loadTabs();
  await loadRecentlyClosed();
  
  // Setup event listeners
  setupEventListeners();
  
  // Focus search input
  elements.searchInput.focus();
});

async function loadPreferences() {
  try {
    const result = await chrome.storage.local.get(['expandedDomains', 'recentlyClosedExpanded', 'theme']);
    if (result.expandedDomains) state.expandedDomains = new Set(result.expandedDomains);
    if (typeof result.recentlyClosedExpanded === 'boolean') state.recentlyClosedExpanded = result.recentlyClosedExpanded;
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
      recentlyClosedExpanded: state.recentlyClosedExpanded,
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
  
  elements.recentlyClosedSection.style.display = 'block';
  elements.recentlyClosedSection.classList.toggle('expanded', state.recentlyClosedExpanded);
  elements.recentlyClosedHeader.classList.toggle('expanded', state.recentlyClosedExpanded);
  elements.recentlyClosedCount.textContent = `(${filtered.length})`;
  
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
  return (
    (tab.title && tab.title.toLowerCase().includes(q)) ||
    (tab.url && tab.url.toLowerCase().includes(q)) ||
    (tab.domain && tab.domain.toLowerCase().includes(q))
  );
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
    elements.emptyState.style.display = 'flex';
    elements.tabList.innerHTML = '';
    elements.expandCollapseBtn.style.display = 'none';
    return;
  }
  
  elements.emptyState.style.display = 'none';
  
  if (state.groupByDomain) {
    renderGrouped();
  } else {
    renderFlat();
  }
  
  // Render recently closed
  renderRecentlyClosed();
}

function renderFlat() {
  elements.expandCollapseBtn.style.display = 'none';
  
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
  
  // Show expand/collapse button if there are groups
  elements.expandCollapseBtn.style.display = domainGroups.length > 0 ? 'block' : 'none';
  updateExpandCollapseIcon();
  
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
  const duration = getFormattedDuration(tab.openedAt);
  
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
          ${duration ? `
            <span class="tab-meta-separator">•</span>
            <span class="tab-duration">
              <svg class="icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
              </svg>
              ${duration}
            </span>
          ` : ''}
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
  
  // Refresh button
  elements.refreshBtn.addEventListener('click', async () => {
    await loadTabCreationTimes();
    await loadTabs();
    await loadRecentlyClosed();
  });
  
  // Expand/Collapse all
  elements.expandCollapseBtn.addEventListener('click', () => {
    const domains = Array.from(document.querySelectorAll('.domain-group')).map(el => el.dataset.domain);
    
    if (state.expandedDomains.size === domains.length) {
      // Collapse all
      state.expandedDomains.clear();
    } else {
      // Expand all
      domains.forEach(d => state.expandedDomains.add(d));
    }
    
    savePreferences();
    render();
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', handleKeyDown);
  
  // Recently closed header toggle
  elements.recentlyClosedHeader.addEventListener('click', () => {
    toggleRecentlyClosed();
  });
  
  // Theme toggle
  elements.themeBtn.addEventListener('click', () => {
    toggleTheme();
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
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tabId, { active: true });
    window.close();
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
        } else if (item.classList.contains('section-header')) {
          toggleRecentlyClosed();
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
  const items = Array.from(document.querySelectorAll('.tab-item, .domain-header, .section-header, .recently-closed-item'));
  
  return items.filter(item => {
    // If Recently Closed is collapsed, exclude its items
    if (!state.recentlyClosedExpanded && item.classList.contains('recently-closed-item')) {
      return false;
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

function updateExpandCollapseIcon() {
  const domains = Array.from(document.querySelectorAll('.domain-group')).map(el => el.dataset.domain);
  const allExpanded = domains.length > 0 && state.expandedDomains.size === domains.length;
  
  const iconPath = allExpanded
    ? 'M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z'
    : 'M7.646 11.354a.5.5 0 0 1 0-.708L13.293 5H.5a.5.5 0 0 1 0-1h12.793l-5.647-5.646a.5.5 0 0 1 .708-.708l6.5 6.5a.5.5 0 0 1 0 .708l-6.5 6.5a.5.5 0 0 1-.708 0z';
  
  elements.expandCollapseIcon.innerHTML = `<path d="${iconPath}"/>`;
  elements.expandCollapseBtn.title = allExpanded ? 'Collapse all' : 'Expand all';
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
