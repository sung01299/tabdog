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
    <svg class="domain-chevron" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
    {#if hasActive}<span class="indicator active"></span>{/if}
    <Favicon src={favicon} />
    <span class="domain-name">{group.domain}</span>
    <span class="domain-count">{group.tabs.length}</span>
    <button class="domain-close-all" title="Close all tabs from {group.domain}" onclick={(e) => { e.stopPropagation(); oncloseall?.(group.domain); }}>
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
      Close All
    </button>
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
    padding: 10px 12px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .domain-header:hover {
    background: var(--bg-hover);
  }
  .domain-chevron {
    width: 12px;
    height: 12px;
    color: var(--text-tertiary);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .domain-header.expanded .domain-chevron {
    transform: rotate(90deg);
  }
  .indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .indicator.active { background: var(--accent-color); }
  .domain-name {
    flex: 1;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .domain-count {
    padding: 2px 8px;
    font-size: 11px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    border-radius: 100px;
  }
  .domain-close-all {
    display: none;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 11px;
    color: var(--danger-color);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .domain-header:hover .domain-close-all {
    display: flex;
  }
  .domain-close-all:hover {
    background: rgba(255, 59, 48, 0.1);
  }
  .domain-close-all svg {
    width: 10px;
    height: 10px;
  }
  .domain-tabs :global(.tab-item) {
    padding-left: 20px;
  }
</style>
