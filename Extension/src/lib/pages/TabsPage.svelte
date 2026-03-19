<script>
  import { tabsStore } from '../stores/tabs.svelte.js';
  import TabItem from '../components/TabItem.svelte';
  import DomainGroup from '../components/DomainGroup.svelte';
  import RecentlyClosed from '../components/RecentlyClosed.svelte';

  let { searchQuery = '' } = $props();

  $effect(() => {
    tabsStore.searchQuery = searchQuery;
  });

  const { domainGroups, filtered, filteredRecentlyClosed, recentlyClosed } = $derived(tabsStore);
  const hasResults = $derived(filtered.length > 0 || filteredRecentlyClosed.length > 0);
</script>

<div class="page">
  <div class="scrollable-content">
    <main class="tab-list">
      {#if filtered.length === 0 && filteredRecentlyClosed.length === 0}
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm1 0v10h10V3H3z"/>
          </svg>
          <span>No tabs found</span>
        </div>
      {:else}
        {#each domainGroups.groups as group (group.domain)}
          <DomainGroup
            {group}
            expanded={tabsStore.isDomainExpanded(group.domain)}
            ontoggle={(d) => tabsStore.toggleDomain(d)}
            onactivate={(id) => tabsStore.activateTab(id)}
            onclose={(id) => tabsStore.closeTab(id)}
            oncloseall={(d) => tabsStore.closeAllInDomain(d)}
          />
        {/each}

        {#each domainGroups.singles as tab (tab.id)}
          <TabItem
            {tab}
            onactivate={(id) => tabsStore.activateTab(id)}
            onclose={(id) => tabsStore.closeTab(id)}
          />
        {/each}
      {/if}
    </main>

    <RecentlyClosed
      tabs={filteredRecentlyClosed}
      totalCount={recentlyClosed.length}
      expanded={tabsStore.recentlyClosedExpanded}
      searching={!!searchQuery}
      ontoggle={() => tabsStore.toggleRecentlyClosed()}
      onreopen={(sid) => tabsStore.reopenTab(sid)}
    />
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
  .scrollable-content::-webkit-scrollbar-thumb:hover {
    background: var(--text-tertiary);
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
</style>
