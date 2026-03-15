<script>
  import Favicon from './Favicon.svelte';
  import { truncateTitle } from '../utils.js';

  let { tab, onactivate, onclose } = $props();

  function handleClick(e) {
    if (!e.target.closest('.tab-close')) {
      onactivate?.(tab.id);
    }
  }

  function handleClose(e) {
    e.stopPropagation();
    onclose?.(tab.id);
  }
</script>

<div class="tab-item" class:active-tab={tab.active} onclick={handleClick}>
  <Favicon src={tab.favIconUrl} alt={tab.domain} />
  <div class="tab-info">
    <div class="tab-title-row">
      {#if tab.pinned}<span class="indicator pinned"></span>{/if}
      {#if tab.active}<span class="indicator active"></span>{/if}
      <span class="tab-title">{truncateTitle(tab.title)}</span>
    </div>
    <div class="tab-meta">
      <span class="tab-domain">{tab.domain}</span>
    </div>
  </div>
  <button class="tab-close" title="Close tab" onclick={handleClose}>
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  </button>
</div>

<style>
  .tab-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .tab-item:hover {
    background: var(--bg-hover);
  }
  .tab-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tab-title-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .indicator.active { background: var(--accent-color); }
  .indicator.pinned { background: var(--warning-color); }
  .tab-title {
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);
  }
  .tab-domain {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-close {
    display: none;
    padding: 4px;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .tab-item:hover .tab-close {
    display: block;
  }
  .tab-close:hover {
    background: var(--bg-tertiary);
    color: var(--danger-color);
  }
  .tab-close svg {
    width: 12px;
    height: 12px;
  }
</style>
