<script>
  import { slide } from 'svelte/transition';
  import Favicon from './Favicon.svelte';
  import { getRelativeTime } from '../utils.js';

  let { tabs = [], expanded = false, totalCount = 0, searching = false, ontoggle, onreopen } = $props();

  const countDisplay = $derived(
    searching ? `${tabs.length}/${totalCount}` : `${tabs.length}`
  );

  const isExpanded = $derived(searching ? true : expanded);
</script>

{#if tabs.length > 0}
  <section class="section" class:expanded={isExpanded}>
    <div class="section-header" class:expanded={isExpanded} onclick={() => ontoggle?.()}>
      <svg class="chevron" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
      </svg>
      <svg class="section-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
        <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
      </svg>
      <span class="section-title">Recently Closed</span>
      <span class="count-badge">{countDisplay}</span>
    </div>
    {#if isExpanded}
      <div class="list" transition:slide={{ duration: 150 }}>
        {#each tabs as tab (tab.sessionId)}
          <div class="item" onclick={() => onreopen?.(tab.sessionId)}>
            <Favicon src={tab.favIconUrl} alt={tab.domain} />
            <div class="item-info">
              <span class="item-title">{tab.title || tab.domain}</span>
              <div class="item-meta">
                <span>{tab.domain}</span>
                <span class="dot">·</span>
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
  .section {
    border-top: 1px solid var(--divider-color);
    flex-shrink: 0;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 12px;
    background: var(--bg-secondary);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .section-header:hover {
    background: var(--bg-hover);
  }
  .chevron {
    width: 10px;
    height: 10px;
    color: var(--text-tertiary);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .section-header.expanded .chevron {
    transform: rotate(90deg);
  }
  .section-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    color: var(--text-tertiary);
  }
  .section-title {
    flex: 1;
  }
  .count-badge {
    padding: 1px 7px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    border-radius: 100px;
    text-transform: none;
    letter-spacing: 0;
  }
  .list {
    max-height: 180px;
    overflow-y: auto;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .item:hover {
    background: var(--bg-hover);
  }
  .item:last-child {
    border-bottom: none;
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
  .item-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--text-tertiary);
  }
  .dot {
    color: var(--text-tertiary);
  }
  .reopen-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 500;
    color: var(--accent-color);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: background 0.15s ease, opacity 0.15s ease;
  }
  .item:hover .reopen-btn {
    opacity: 1;
    pointer-events: auto;
  }
  .reopen-btn:hover {
    background: rgba(0, 122, 255, 0.1);
  }
  .reopen-btn svg {
    width: 10px;
    height: 10px;
  }
</style>
