<script>
  import { slide } from 'svelte/transition';
  import Favicon from './Favicon.svelte';
  import { getDomain } from '../utils.js';

  let { workspace, expanded = false, ontoggle, onrestore, onedit, ondelete } = $props();

  const WORKSPACE_COLORS = {
    blue: '#007AFF', purple: '#AF52DE', pink: '#FF2D55', red: '#FF3B30',
    orange: '#FF9500', yellow: '#FFCC00', green: '#34C759', teal: '#5AC8FA', gray: '#8E8E93',
  };

  const iconColor = $derived(WORKSPACE_COLORS[workspace.color] || WORKSPACE_COLORS.blue);
</script>

<div class="workspace-group" class:expanded>
  <div class="workspace-header" class:expanded onclick={() => ontoggle?.(workspace.id)}>
    <svg class="workspace-chevron" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/>
    </svg>
    <svg class="workspace-icon" viewBox="0 0 16 16" fill="currentColor" style="color: {iconColor}">
      <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
    </svg>
    <span class="workspace-name">{workspace.name}</span>
    <span class="workspace-tab-count">{workspace.tabs.length} tabs</span>
    <button class="action-btn" title="Edit" onclick={(e) => { e.stopPropagation(); onedit?.(workspace.id); }}>
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
      </svg>
    </button>
    <button class="action-btn" title="Open all tabs" onclick={(e) => { e.stopPropagation(); onrestore?.(workspace.id); }}>
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
        <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
      </svg>
    </button>
    <button class="action-btn" title="Delete" onclick={(e) => { e.stopPropagation(); ondelete?.(workspace.id); }}>
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
      </svg>
    </button>
  </div>
  {#if expanded}
    <div class="workspace-tabs" transition:slide={{ duration: 150 }}>
      {#each workspace.tabs as tab, i}
        {@const domain = getDomain(tab.url)}
        <div class="workspace-tab-item" onclick={() => { chrome.tabs.create({ url: tab.url, active: true }); window.close(); }}>
          <Favicon src={tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt={domain} />
          <div class="workspace-tab-info">
            <span class="workspace-tab-title">{tab.title || 'Untitled'}</span>
            <span class="workspace-tab-url">{domain}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .workspace-group {
    border-bottom: 1px solid var(--divider-color);
  }
  .workspace-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .workspace-header:hover {
    background: var(--bg-hover);
  }
  .workspace-chevron {
    width: 12px;
    height: 12px;
    color: var(--text-tertiary);
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  .workspace-header.expanded .workspace-chevron {
    transform: rotate(90deg);
  }
  .workspace-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  .workspace-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .workspace-tab-count {
    font-size: 12px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
  .action-btn {
    padding: 6px;
    background: none;
    border: none;
    color: transparent;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
  }
  .workspace-header:hover .action-btn {
    color: var(--text-tertiary);
  }
  .action-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .action-btn svg {
    width: 14px;
    height: 14px;
  }
  .workspace-tab-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .workspace-tab-item:hover {
    background: var(--bg-hover);
  }
  .workspace-tab-item:last-child {
    border-bottom: none;
  }
  .workspace-tab-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .workspace-tab-title {
    display: block;
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .workspace-tab-url {
    display: block;
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
