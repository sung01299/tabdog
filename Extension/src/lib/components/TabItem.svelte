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
      {#if tab.pinned}<span class="badge pinned">PIN</span>{/if}
      {#if tab.active}<span class="active-dot"></span>{/if}
      <span class="tab-title">{truncateTitle(tab.title)}</span>
    </div>
    <span class="tab-domain">{tab.domain}</span>
  </div>
  <button class="tab-close" title="Close tab" onclick={handleClose}>
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
    Close
  </button>
</div>

<style>
  .tab-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .tab-item:hover {
    background: var(--bg-hover);
  }
  .active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-color);
    flex-shrink: 0;
  }
  .tab-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tab-title-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .badge {
    padding: 0px 4px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.5px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .badge.pinned {
    color: var(--warning-color);
    background: rgba(255, 149, 0, 0.12);
  }
  .tab-title {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-domain {
    font-size: 10px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-close {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 11px;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--danger-color);
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: background 0.15s ease, opacity 0.15s ease;
  }
  .tab-item:hover .tab-close {
    opacity: 1;
    pointer-events: auto;
  }
  .tab-close:hover {
    background: rgba(255, 59, 48, 0.1);
  }
  .tab-close svg {
    width: 10px;
    height: 10px;
  }
</style>
