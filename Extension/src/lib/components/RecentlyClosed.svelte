<script>
  import Favicon from './Favicon.svelte';
  import { getRelativeTime } from '../utils.js';

  let { tabs = [], expanded = false, totalCount = 0, searching = false, ontoggle, onreopen } = $props();

  const countDisplay = $derived(
    searching ? `(${tabs.length}/${totalCount})` : `(${tabs.length})`
  );

  const isExpanded = $derived(searching ? true : expanded);
</script>

{#if tabs.length > 0}
  <section class="recently-closed-section" class:expanded={isExpanded}>
    <div class="section-header" class:expanded={isExpanded} onclick={() => ontoggle?.()}>
      <svg class="section-chevron" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
      </svg>
      <svg class="section-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
      </svg>
      <span>Recently Closed</span>
      <span class="section-count">{countDisplay}</span>
    </div>
    {#if isExpanded}
      <div class="recently-closed-list">
        {#each tabs as tab (tab.sessionId)}
          <div class="recently-closed-item" onclick={() => onreopen?.(tab.sessionId)}>
            <Favicon src={tab.favIconUrl} alt={tab.domain} />
            <div class="recently-closed-info">
              <div class="recently-closed-title">{tab.title || tab.domain}</div>
              <div class="recently-closed-meta">
                <span>{tab.domain}</span>
                <span class="separator">•</span>
                <span>{getRelativeTime(tab.closedAt)}</span>
              </div>
            </div>
            <button class="reopen-btn" onclick={(e) => { e.stopPropagation(); onreopen?.(tab.sessionId); }}>
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2V3z"/>
                <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
              </svg>
              Reopen
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .recently-closed-section {
    border-top: 1px solid var(--divider-color);
    flex-shrink: 0;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    background: var(--bg-secondary);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .section-header:hover {
    background: var(--bg-hover);
  }
  .section-chevron {
    width: 12px;
    height: 12px;
    color: var(--text-tertiary);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .section-header.expanded .section-chevron {
    transform: rotate(90deg);
  }
  .section-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--text-tertiary);
  }
  .section-count {
    color: var(--text-tertiary);
    font-weight: 400;
  }
  .recently-closed-list {
    max-height: 150px;
    overflow-y: auto;
  }
  .recently-closed-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .recently-closed-item:hover {
    background: var(--bg-hover);
  }
  .recently-closed-item:last-child {
    border-bottom: none;
  }
  .recently-closed-info {
    flex: 1;
    min-width: 0;
  }
  .recently-closed-title {
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recently-closed-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-tertiary);
  }
  .separator {
    color: var(--text-tertiary);
  }
  .reopen-btn {
    display: none;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 11px;
    color: var(--accent-color);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .recently-closed-item:hover .reopen-btn {
    display: flex;
  }
  .reopen-btn:hover {
    background: rgba(0, 122, 255, 0.1);
  }
  .reopen-btn svg {
    width: 12px;
    height: 12px;
  }
</style>
