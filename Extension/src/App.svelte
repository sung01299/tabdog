<script>
  import { fade } from 'svelte/transition';
  import { themeStore } from './lib/stores/theme.svelte.js';
  import { authStore } from './lib/stores/auth.svelte.js';
  import { navigationStore } from './lib/stores/navigation.svelte.js';
  import { tabsStore } from './lib/stores/tabs.svelte.js';
  import { workspacesStore } from './lib/stores/workspaces.svelte.js';
  import { modalStore } from './lib/stores/modal.svelte.js';

  import LoginScreen from './lib/pages/LoginScreen.svelte';
  import Header from './lib/components/Header.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import BottomNav from './lib/components/BottomNav.svelte';
  import TabsPage from './lib/pages/TabsPage.svelte';
  import WorkspacesPage from './lib/pages/WorkspacesPage.svelte';
  import ConversationsPage from './lib/pages/ConversationsPage.svelte';
  import HistoryPage from './lib/pages/HistoryPage.svelte';
  import SaveWorkspaceModal from './lib/components/modals/SaveWorkspaceModal.svelte';

  let searchQuery = $state('');
  let selectedIndex = $state(-1);

  $effect(() => {
    themeStore.init();
    authStore.init();
  });

  let prevLoggedIn = $state(false);
  $effect(() => {
    if (authStore.isLoggedIn && !prevLoggedIn) {
      tabsStore.init();
      workspacesStore.init();
    }
    prevLoggedIn = authStore.isLoggedIn;
  });

  $effect(() => {
    navigationStore.currentPage;
    selectedIndex = -1;
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  });

  $effect(() => {
    searchQuery;
    selectedIndex = -1;
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  });

  function getSelectableItems() {
    const page = navigationStore.currentPage;
    let selector = '';
    if (page === 'tabs') {
      selector = '.page .tab-item, .page .domain-header, .page .section-header, .page .item';
    } else if (page === 'workspaces') {
      selector = '.page .card-header, .page .tab-row';
    } else if (page === 'conversations') {
      selector = '.page .conversation-item, .page .start-chat-btn';
    } else if (page === 'history') {
      selector = '.page .history-item';
    }
    if (!selector) return [];

    const items = Array.from(document.querySelectorAll(selector));
    return items.filter(el => {
      if (el.closest('.domain-tabs') && !el.closest('.domain-group.expanded')) return false;
      if (el.closest('.workspace-card .tab-list') && !el.closest('.workspace-card.expanded')) return false;
      if (el.closest('.list') && !el.closest('.section.expanded')) return false;
      return true;
    });
  }

  function updateSelection(items) {
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    if (selectedIndex >= 0 && items[selectedIndex]) {
      items[selectedIndex].classList.add('selected');
      items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function getSearchInput() {
    return document.querySelector('.search-bar input') || document.querySelector('.search-field input');
  }

  function handleKeydown(e) {
    if (modalStore.active) return;

    const items = getSelectableItems();
    const searchInput = getSearchInput();

    if (e.code === 'KeyC' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (selectedIndex >= 0 && document.activeElement !== searchInput) {
        e.preventDefault();
        const item = items[selectedIndex];
        const closeBtn = item?.querySelector('.tab-close, .close-all-btn');
        if (closeBtn) closeBtn.click();
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (selectedIndex < items.length - 1) {
          selectedIndex++;
          updateSelection(items);
          if (selectedIndex >= 0) searchInput?.blur();
        } else if (selectedIndex === items.length - 1) {
          selectedIndex = -1;
          searchInput?.focus();
          updateSelection(items);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (selectedIndex > 0) {
          selectedIndex--;
          updateSelection(items);
        } else if (selectedIndex === 0) {
          selectedIndex = -1;
          searchInput?.focus();
          updateSelection(items);
        } else if (selectedIndex === -1 && items.length > 0) {
          selectedIndex = items.length - 1;
          searchInput?.blur();
          updateSelection(items);
        }
        break;

      case 'Enter':
        if (selectedIndex >= 0 && items[selectedIndex]) {
          e.preventDefault();
          items[selectedIndex].click();
        }
        break;

      case 'Escape':
        e.preventDefault();
        if (searchQuery) {
          searchQuery = '';
          selectedIndex = -1;
          searchInput?.focus();
          updateSelection(items);
        } else {
          window.close();
        }
        break;

      case 'f':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          if (navigationStore.currentPage !== 'tabs') navigationStore.switchTo('tabs');
          selectedIndex = -1;
          updateSelection(items);
          requestAnimationFrame(() => {
            const input = getSearchInput();
            input?.focus();
            input?.select();
          });
        }
        break;

      case '1':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); navigationStore.switchTo('tabs'); }
        break;
      case '2':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); navigationStore.switchTo('workspaces'); }
        break;
      case '3':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); navigationStore.switchTo('conversations'); }
        break;
      case '4':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); navigationStore.switchTo('history'); }
        break;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  {#if !authStore.isLoggedIn}
    <LoginScreen />
  {:else}
    <div class="app-content">
      <Header />

      {#if navigationStore.showSearchBar}
        <SearchBar bind:value={searchQuery} autofocus />
      {/if}

      <div class="page-container">
        {#key navigationStore.currentPage}
          <div class="page-wrapper" in:fade={{ duration: 120 }}>
            {#if navigationStore.currentPage === 'tabs'}
              <TabsPage {searchQuery} />
            {:else if navigationStore.currentPage === 'workspaces'}
              <WorkspacesPage />
            {:else if navigationStore.currentPage === 'conversations'}
              <ConversationsPage />
            {:else if navigationStore.currentPage === 'history'}
              <HistoryPage />
            {/if}
          </div>
        {/key}
      </div>

      <BottomNav />
    </div>
  {/if}
</div>

{#if modalStore.active === 'saveWorkspace'}
  <SaveWorkspaceModal
    editWorkspaceId={modalStore.props.editWorkspaceId}
    onclose={() => modalStore.close()}
  />
{/if}


<style>
  .container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
    max-height: 600px;
    position: relative;
  }
  .app-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    overflow: hidden;
  }
  .page-container {
    flex: 1;
    overflow: hidden;
    position: relative;
    min-height: 0;
  }
  .page-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
