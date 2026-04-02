export function getDomain(url) {
  try {
    if (!url) return 'unknown';
    if (url.startsWith('file://')) return 'Local Files';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return new URL(url).hostname || 'chrome';
    }
    return new URL(url).hostname.replace(/^www\./, '') || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function truncateTitle(title, maxLength = 60) {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}

export function getRelativeTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export const CHAT_SESSIONS_KEY = 'tabdogChatSessions';
export const CHAT_LAUNCH_CONTEXT_KEY = 'tabdogChatLaunchContext';

function truncateText(text, maxLength = 72) {
  const normalized = (text || '').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

export function getChatSessionTitle(session) {
  if (session?.title) {
    return session.title;
  }

  const firstUserMessage = (session?.messages || []).find((message) =>
    message.role === 'user' && message.content?.trim(),
  );
  if (firstUserMessage) {
    return truncateText(firstUserMessage.content, 42);
  }

  const titles = (session?.tabSummaries || [])
    .map((summary) => summary?.title?.trim())
    .filter(Boolean);

  if (titles.length > 1) {
    return `${titles[0]} +${titles.length - 1}`;
  }

  if (titles.length === 1) {
    return titles[0];
  }

  return 'New conversation';
}

export function getChatSessionPreview(session) {
  const messages = [...(session?.messages || [])].reverse();
  const latestMessage = messages.find((message) => message.content?.trim());

  if (latestMessage) {
    return truncateText(latestMessage.content, 92);
  }

  const tabs = (session?.tabSummaries || [])
    .map((summary) => summary?.title?.trim())
    .filter(Boolean);

  if (!tabs.length) {
    return 'No messages yet';
  }

  return truncateText(`Tabs: ${tabs.join(', ')}`, 92);
}

export function formatChatTimestamp(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (date.toDateString() === today.toDateString()) {
    return `Today · ${time}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${time}`;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function createChatSession({ selectedTabs = [], tabSummaries = [] } = {}) {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    messages: [],
    tabSummaries,
    tabRefs: selectedTabs.map((tab) => ({
      tabId: tab.id,
      url: tab.url || '',
      title: tab.title || 'Untitled tab',
    })),
    usageMessage: '',
    title: '',
  };
}

export function normalizeChatSessions(rawSessions = {}) {
  const entries = Object.entries(rawSessions)
    .map(([key, session]) => {
      if (!session || typeof session !== 'object') {
        return null;
      }

      const id = session.id || key;
      const updatedAt = session.updatedAt || session.createdAt || Date.now();
      const createdAt = session.createdAt || updatedAt;
      const tabSummaries = Array.isArray(session.tabSummaries) ? session.tabSummaries : [];
      const tabRefs = Array.isArray(session.tabRefs) && session.tabRefs.length
        ? session.tabRefs
        : tabSummaries.map((summary) => ({
            tabId: summary?.tabId,
            url: summary?.url || '',
            title: summary?.title || 'Untitled tab',
          }));

      const normalized = {
        ...session,
        id,
        createdAt,
        updatedAt,
        messages: Array.isArray(session.messages) ? session.messages : [],
        tabSummaries,
        tabRefs,
        usageMessage: session.usageMessage || '',
      };

      normalized.title = getChatSessionTitle(normalized);
      return [id, normalized];
    })
    .filter(Boolean);

  return Object.fromEntries(entries);
}

export async function loadChatSessions() {
  const result = await chrome.storage.local.get(CHAT_SESSIONS_KEY);
  return normalizeChatSessions(result[CHAT_SESSIONS_KEY] || {});
}

export async function saveChatSessions(sessions) {
  await chrome.storage.local.set({
    [CHAT_SESSIONS_KEY]: normalizeChatSessions(sessions),
  });
}

export function sortChatSessions(sessions) {
  return Object.values(normalizeChatSessions(sessions))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function openChatSidePanel(options = {}) {
  if (!globalThis.chrome?.sidePanel?.open) {
    throw new Error('This version of Chrome does not support side panel opening from the popup.');
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id || activeTab.windowId == null) {
    throw new Error('No active tab is available to open TabDog Chat.');
  }

  await chrome.storage.local.set({
    [CHAT_LAUNCH_CONTEXT_KEY]: {
      mode: options.mode || 'new',
      sessionId: options.sessionId || '',
      tabId: activeTab.id,
      windowId: activeTab.windowId,
      url: activeTab.url || '',
      createdAt: Date.now(),
    },
  });

  await chrome.sidePanel.open({
    tabId: activeTab.id,
    windowId: activeTab.windowId,
  });

  window.close();
}
