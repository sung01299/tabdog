<script>
  import Favicon from '../components/Favicon.svelte';
  import { getDomain, formatDate, formatTime } from '../utils.js';

  let historyByDate = $state([]);
  let searchText = $state('');
  let empty = $state(false);
  let searchTimeout;

  $effect(() => {
    loadHistory('');
  });

  async function loadHistory(query) {
    if (!globalThis.chrome?.history) {
      historyByDate = [];
      empty = true;
      return;
    }

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const items = await chrome.history.search({
      text: query,
      startTime: oneWeekAgo,
      maxResults: 200,
    });

    if (items.length === 0) {
      historyByDate = [];
      empty = true;
      return;
    }

    empty = false;

    const grouped = {};
    for (const item of items) {
      const date = new Date(item.lastVisitTime).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    }

    historyByDate = Object.keys(grouped)
      .sort()
      .reverse()
      .map(date => ({ date, items: grouped[date] }));
  }

  function handleSearchInput(e) {
    searchText = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadHistory(searchText.trim());
    }, 300);
  }

  function openUrl(url) {
    chrome.tabs.create({ url, active: true });
    window.close();
  }
</script>

<div class="page">
  <div class="scrollable-content">
    <div class="history-search-bar">
      <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
      </svg>
      <input type="text" placeholder="Search history..." value={searchText} oninput={handleSearchInput} autocomplete="off">
    </div>

    {#if empty}
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022l-.074.997zm2.004.45a7.003 7.003 0 0 0-.985-.299l.219-.976c.383.086.76.2 1.126.342l-.36.933z"/>
          <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
          <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/>
        </svg>
        <span>No tab history</span>
        <p class="empty-hint">Your opened and closed tabs will appear here</p>
      </div>
    {:else}
      {#each historyByDate as dateGroup (dateGroup.date)}
        <div class="history-date-group">
          <div class="history-date-header">{formatDate(dateGroup.date)}</div>
          {#each dateGroup.items as item (item.id + '-' + item.lastVisitTime)}
            {@const domain = getDomain(item.url)}
            <div class="history-item" onclick={() => openUrl(item.url)}>
              <Favicon src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt={domain} />
              <div class="history-item-info">
                <span class="history-item-title">{item.title || domain}</span>
                <span class="history-item-url">{domain}</span>
              </div>
              <span class="history-item-time">{formatTime(new Date(item.lastVisitTime).toISOString())}</span>
            </div>
          {/each}
        </div>
      {/each}
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
  .history-search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--divider-color);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .search-icon {
    width: 14px;
    height: 14px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
  .history-search-bar input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    font-family: inherit;
  }
  .history-search-bar input::placeholder {
    color: var(--text-tertiary);
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
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
    margin-top: 4px;
  }
  .history-date-group {
    margin-bottom: 8px;
  }
  .history-date-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: sticky;
    top: 0;
  }
  .history-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .history-item:hover {
    background: var(--bg-hover);
  }
  .history-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .history-item-title {
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .history-item-url {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .history-item-time {
    font-size: 11px;
    color: var(--text-tertiary);
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>
