<!--
  LEGACY NOTICE:
  This conversations page belongs to the legacy in-extension chat/RAG flow.
  It remains as a compatibility UI while chat moves to the backend architecture.
-->
<script>
  import { onMount } from 'svelte';
  import {
    CHAT_SESSIONS_KEY,
    formatChatTimestamp,
    getChatSessionPreview,
    loadChatSessions,
    openChatSidePanel,
    sortChatSessions,
  } from '../utils.js';

  let conversations = $state([]);
  let loading = $state(true);
  let error = $state('');

  async function refreshConversations() {
    loading = true;

    try {
      const sessions = await loadChatSessions();
      conversations = sortChatSessions(sessions);
    } catch (e) {
      error = e?.message || 'Failed to load conversations.';
    } finally {
      loading = false;
    }
  }

  async function handleStartNewChat() {
    error = '';

    try {
      await openChatSidePanel({ mode: 'new' });
    } catch (e) {
      error = e?.message || 'Failed to open TabDog Chat.';
    }
  }

  async function handleOpenConversation(sessionId) {
    error = '';

    try {
      await openChatSidePanel({
        mode: 'conversation',
        sessionId,
      });
    } catch (e) {
      error = e?.message || 'Failed to open the selected conversation.';
    }
  }

  onMount(() => {
    refreshConversations();

    const handleStorageChanged = (changes, areaName) => {
      if (areaName === 'local' && changes[CHAT_SESSIONS_KEY]) {
        refreshConversations();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  });
</script>

<div class="page">
  <div class="scrollable-content">
    {#if loading}
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM3.5 7.25a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm4.5 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm4.5 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z"/>
        </svg>
        <span>Loading conversations...</span>
      </div>
    {:else if conversations.length === 0}
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 12a5.96 5.96 0 0 1-3.34-1.01l-1.53.51.5-1.44A6 6 0 1 1 8 13z"/>
        </svg>
        <span>No conversations yet</span>
        <p class="empty-hint">Start a new chat to keep a reusable conversation thread.</p>
      </div>
    {:else}
      <div class="conversation-list">
        {#each conversations as session (session.id)}
          <button
            class="conversation-item"
            onclick={() => handleOpenConversation(session.id)}
          >
            <div class="conversation-icon">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14 7.13 7.13 0 0 0 2.94-.63l2.4.8-.78-2.22A7 7 0 0 0 8 1zm0 1a6 6 0 0 1 5.2 9l-.16.27.45 1.29-1.37-.46-.26.13A6 6 0 1 1 8 2z"/>
              </svg>
            </div>
            <div class="conversation-main">
              <div class="conversation-topline">
                <span class="conversation-title">{session.title}</span>
                <span class="conversation-time">{formatChatTimestamp(session.updatedAt)}</span>
              </div>
              <p class="conversation-preview">{getChatSessionPreview(session)}</p>
              <div class="conversation-meta">
                <span>{session.messages.length} messages</span>
                <span>{Math.max(session.tabRefs?.length || 0, session.tabSummaries?.length || 0)} tabs</span>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}

    <div class="start-chat-row">
      <button class="start-chat-btn" onclick={handleStartNewChat}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
        <span>Start New Chat</span>
      </button>
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
  </div>
</div>

<style>
  .page {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
  }

  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
  }

  .scrollable-content::-webkit-scrollbar {
    width: 6px;
  }

  .scrollable-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollable-content::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }

  .conversation-list {
    display: flex;
    flex-direction: column;
  }

  .conversation-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 12px;
    background: var(--bg-primary);
    border: none;
    border-bottom: 1px solid var(--divider-color);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: inherit;
  }

  .conversation-item:hover {
    background: var(--bg-hover);
  }

  .conversation-item:global(.selected) {
    background: var(--bg-selected);
  }

  .conversation-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: var(--bg-secondary);
    color: var(--accent-color);
    flex-shrink: 0;
  }

  .conversation-icon svg {
    width: 15px;
    height: 15px;
  }

  .conversation-main {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .conversation-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .conversation-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-time {
    font-size: 10px;
    color: var(--text-tertiary);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .conversation-preview {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .conversation-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .start-chat-row {
    padding: 10px 12px 12px;
  }

  .start-chat-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: 1px dashed var(--border-color);
    border-radius: 10px;
    color: var(--text-tertiary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .start-chat-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .start-chat-btn:global(.selected) {
    background: var(--bg-selected);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .start-chat-btn svg {
    width: 14px;
    height: 14px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 60px 20px 36px;
    color: var(--text-secondary);
  }

  .empty-icon {
    width: 32px;
    height: 32px;
    color: var(--text-tertiary);
  }

  .empty-hint {
    font-size: 11px;
    color: var(--text-tertiary);
    text-align: center;
    max-width: 220px;
    line-height: 1.5;
  }

  .error-banner {
    margin: 0 12px 12px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--danger-color);
    background: rgba(255, 59, 48, 0.08);
    border-radius: 10px;
  }
</style>
