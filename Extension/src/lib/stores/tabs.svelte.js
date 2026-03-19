import { getDomain } from '../utils.js';

function createTabsStore() {
  let tabs = $state([]);
  let recentlyClosed = $state([]);
  let searchQuery = $state('');
  let expandedDomains = $state(new Set());
  let recentlyClosedExpanded = $state(false);
  let tabCreationTimes = $state({});

  function matchesSearch(tab, query) {
    const q = query.toLowerCase();
    return (
      (tab.title && tab.title.toLowerCase().includes(q)) ||
      (tab.url && tab.url.toLowerCase().includes(q)) ||
      (tab.domain && tab.domain.toLowerCase().includes(q))
    );
  }

  function sortByLastAccessed(list) {
    return [...list].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }

  const filtered = $derived.by(() => {
    let result = [...tabs];
    if (searchQuery) {
      result = result.filter(t => matchesSearch(t, searchQuery));
    }
    return sortByLastAccessed(result);
  });

  const domainGroups = $derived.by(() => {
    const groups = {};
    const singles = [];

    for (const tab of filtered) {
      if (!groups[tab.domain]) groups[tab.domain] = [];
      groups[tab.domain].push(tab);
    }

    const multiGroups = [];
    for (const [domain, domainTabs] of Object.entries(groups)) {
      if (domainTabs.length >= 2) {
        multiGroups.push({ domain, tabs: domainTabs });
      } else {
        singles.push(...domainTabs);
      }
    }

    multiGroups.sort((a, b) => {
      const timeA = Math.max(...a.tabs.map(t => t.lastAccessed || 0));
      const timeB = Math.max(...b.tabs.map(t => t.lastAccessed || 0));
      return timeB - timeA;
    });

    return { groups: multiGroups, singles: sortByLastAccessed(singles) };
  });

  const filteredRecentlyClosed = $derived.by(() => {
    if (!searchQuery) return recentlyClosed;
    return recentlyClosed.filter(t => matchesSearch(t, searchQuery));
  });

  return {
    get tabs() { return tabs; },
    get filtered() { return filtered; },
    get domainGroups() { return domainGroups; },
    get recentlyClosed() { return recentlyClosed; },
    get filteredRecentlyClosed() { return filteredRecentlyClosed; },
    get recentlyClosedExpanded() { return recentlyClosedExpanded; },
    get expandedDomains() { return expandedDomains; },

    get searchQuery() { return searchQuery; },
    set searchQuery(v) { searchQuery = v; },

    isDomainExpanded(domain) {
      return expandedDomains.has(domain);
    },

    toggleDomain(domain) {
      const next = new Set(expandedDomains);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      expandedDomains = next;
      this._savePrefs();
    },

    toggleRecentlyClosed() {
      recentlyClosedExpanded = !recentlyClosedExpanded;
      this._savePrefs();
    },

    async init() {
      await this._loadPrefs();
      await this._loadTabCreationTimes();
      await this.loadTabs();
      await this.loadRecentlyClosed();
    },

    async loadTabs() {
      try {
        const chromeTabs = await chrome.tabs.query({});
        tabs = chromeTabs.map(tab => ({
          ...tab,
          domain: getDomain(tab.url),
          openedAt: tabCreationTimes[tab.id] || Date.now(),
          lastAccessed: tab.lastAccessed || Date.now(),
        }));
      } catch (e) {
        console.error('Failed to load tabs:', e);
      }
    },

    async loadRecentlyClosed() {
      try {
        const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        recentlyClosed = sessions
          .filter(s => s.tab)
          .map(s => ({
            ...s.tab,
            sessionId: s.tab.sessionId,
            closedAt: s.lastModified * 1000,
            domain: getDomain(s.tab.url),
          }))
          .filter(t => t.closedAt >= thirtyMinutesAgo);
      } catch (e) {
        console.error('Failed to load recently closed:', e);
      }
    },

    async activateTab(tabId) {
      try {
        chrome.runtime.sendMessage({ action: 'activateTab', tabId });
        setTimeout(() => window.close(), 50);
      } catch (e) {
        console.error('Failed to activate tab:', e);
      }
    },

    async closeTab(tabId) {
      try {
        await chrome.tabs.remove(tabId);
        tabs = tabs.filter(t => t.id !== tabId);
        await this.loadRecentlyClosed();
      } catch (e) {
        console.error('Failed to close tab:', e);
      }
    },

    async closeAllInDomain(domain) {
      try {
        const ids = tabs.filter(t => t.domain === domain).map(t => t.id);
        await chrome.tabs.remove(ids);
        tabs = tabs.filter(t => t.domain !== domain);
        const next = new Set(expandedDomains);
        next.delete(domain);
        expandedDomains = next;
        await this.loadRecentlyClosed();
      } catch (e) {
        console.error('Failed to close tabs:', e);
      }
    },

    async reopenTab(sessionId) {
      try {
        await chrome.sessions.restore(sessionId);
        await this.loadRecentlyClosed();
        window.close();
      } catch (e) {
        console.error('Failed to reopen tab:', e);
      }
    },

    async _loadTabCreationTimes() {
      try {
        if (!globalThis.chrome?.storage) return;
        const result = await chrome.storage.local.get('tabCreationTimes');
        tabCreationTimes = result.tabCreationTimes || {};
      } catch { /* ignore */ }
    },

    async _loadPrefs() {
      try {
        if (!globalThis.chrome?.storage) return;
        const result = await chrome.storage.local.get(['expandedDomains', 'recentlyClosedExpanded']);
        if (result.expandedDomains) expandedDomains = new Set(result.expandedDomains);
        if (typeof result.recentlyClosedExpanded === 'boolean') recentlyClosedExpanded = result.recentlyClosedExpanded;
      } catch { /* ignore */ }
    },

    _savePrefs() {
      try {
        globalThis.chrome?.storage?.local.set({
          expandedDomains: Array.from(expandedDomains),
          recentlyClosedExpanded,
        });
      } catch { /* ignore */ }
    },
  };
}

export const tabsStore = createTabsStore();
