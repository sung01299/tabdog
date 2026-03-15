<script>
  import { navigationStore } from '../stores/navigation.svelte.js';

  const pages = [
    {
      id: 'tabs',
      label: 'Tabs',
      icon: 'M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z',
    },
    {
      id: 'workspaces',
      label: 'Spaces',
      icon: 'M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z',
    },
    {
      id: 'history',
      label: 'History',
      icon: 'M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z',
    },
  ];
</script>

<nav class="bottom-nav">
  {#each pages as page}
    <button
      class="nav-item"
      class:active={navigationStore.currentPage === page.id}
      onclick={() => navigationStore.switchTo(page.id)}
      tabindex="-1"
    >
      <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d={page.icon}/>
      </svg>
      <span class="nav-label">{page.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 6px 8px 10px;
    background: var(--bg-primary);
    border-top: 1px solid var(--divider-color);
    flex-shrink: 0;
  }
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 12px;
    background: none;
    border: none;
    border-radius: 10px;
    color: var(--text-tertiary);
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
    min-width: 60px;
  }
  .nav-item:hover {
    color: var(--text-secondary);
    background: var(--bg-hover);
  }
  .nav-item.active {
    color: var(--accent-color);
  }
  .nav-icon {
    width: 20px;
    height: 20px;
  }
  .nav-label {
    font-size: 10px;
    font-weight: 500;
  }
</style>
