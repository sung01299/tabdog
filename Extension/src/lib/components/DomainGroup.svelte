<script>
  import { slide } from 'svelte/transition';
  import TabItem from './TabItem.svelte';
  import Favicon from './Favicon.svelte';

  let { group, expanded = false, ontoggle, onactivate, onclose, oncloseall } = $props();

  const favicon = $derived(group.tabs.find(t => t.favIconUrl)?.favIconUrl || '');
  const hasActive = $derived(group.tabs.some(t => t.active));
</script>

<div class="domain-group" class:expanded>
  <div class="domain-header" class:expanded onclick={() => ontoggle?.(group.domain)}>
    <svg class="chevron" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
    {#if hasActive}<span class="active-dot"></span>{/if}
    <Favicon src={favicon} />
    <span class="domain-name">{group.domain}</span>
    <button class="close-all-btn" title="Close all tabs from {group.domain}" onclick={(e) => { e.stopPropagation(); oncloseall?.(group.domain); }}>
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
      Close All
    </button>
    <span class="count-badge">{group.tabs.length}</span>
  </div>
  {#if expanded}
    <div class="domain-tabs" transition:slide={{ duration: 150 }}>
      {#each group.tabs as tab (tab.id)}
        <TabItem {tab} {onactivate} {onclose} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .domain-group {
    border-bottom: 1px solid var(--divider-color);
  }
  .domain-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .domain-header:hover {
    background: var(--bg-hover);
  }
  .chevron {
    width: 10px;
    height: 10px;
    color: var(--text-tertiary);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .domain-header.expanded .chevron {
    transform: rotate(90deg);
  }
  .active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-color);
    flex-shrink: 0;
  }
  .domain-name {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .count-badge {
    padding: 1px 7px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    border-radius: 100px;
  }
  .close-all-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 500;
    color: var(--danger-color);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: background 0.15s ease, opacity 0.15s ease;
  }
  .domain-header:hover .close-all-btn {
    opacity: 1;
    pointer-events: auto;
  }
  .close-all-btn:hover {
    background: rgba(255, 59, 48, 0.1);
  }
  .close-all-btn svg {
    width: 10px;
    height: 10px;
  }
  .domain-tabs :global(.tab-item) {
    padding-left: 20px;
  }
</style>
