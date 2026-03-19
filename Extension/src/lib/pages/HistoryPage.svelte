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
    <div class="search-bar">
      <div class="search-field">
        <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
        <input type="text" placeholder="Search history..." value={searchText} oninput={handleSearchInput} autocomplete="off">
      </div>
    </div>

    {#if empty}
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
          <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/>
        </svg>
        <span>No history found</span>
        <p class="empty-hint">Your browsing history will appear here</p>
      </div>
    {:else}
      {#each historyByDate as dateGroup (dateGroup.date)}
        <div class="date-group">
          <div class="date-header">
            <span class="date-label">{formatDate(dateGroup.date)}</span>
            <span class="date-count">{dateGroup.items.length}</span>
          </div>
          {#each dateGroup.items as item (item.id + '-' + item.lastVisitTime)}
            {@const domain = getDomain(item.url)}
            <div class="history-item" onclick={() => openUrl(item.url)}>
              <Favicon src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt={domain} />
              <div class="item-info">
                <span class="item-title">{item.title || domain}</span>
                <span class="item-url">{domain}</span>
              </div>
              <span class="item-time">{formatTime(new Date(item.lastVisitTime).toISOString())}</span>
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
  .search-bar {
    padding: 8px 12px;
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--divider-color);
  }
  .search-field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    background: var(--bg-secondary);
    border-radius: 10px;
    border: 1.5px solid transparent;
    transition: all 0.15s ease;
  }
  .search-field:focus-within {
    border-color: var(--accent-color);
    background: var(--bg-primary);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  }
  .search-icon {
    width: 13px;
    height: 13px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
  .search-field input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    font-family: inherit;
  }
  .search-field input::placeholder {
    color: var(--text-tertiary);
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 60px 20px;
    color: var(--text-secondary);
  }
  .empty-icon {
    width: 32px;
    height: 32px;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }
  .empty-hint {
    font-size: 11px;
    color: var(--text-tertiary);
  }
  .date-group {
    margin-bottom: 4px;
  }
  .date-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    position: sticky;
    top: 0;
  }
  .date-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .date-count {
    padding: 0px 6px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    border-radius: 100px;
  }
  .history-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .history-item:hover {
    background: var(--bg-hover);
  }
  .item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .item-title {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-url {
    font-size: 10px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-time {
    font-size: 10px;
    color: var(--text-tertiary);
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>
