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
  import HistoryPage from './lib/pages/HistoryPage.svelte';
  import SaveWorkspaceModal from './lib/components/modals/SaveWorkspaceModal.svelte';
  import ShareModal from './lib/components/modals/ShareModal.svelte';
  import ShareLinkModal from './lib/components/modals/ShareLinkModal.svelte';
  import RestoreWorkspaceModal from './lib/components/modals/RestoreWorkspaceModal.svelte';

  let searchQuery = $state('');

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

  function handleKeydown(e) {
    if (modalStore.active) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      if (navigationStore.currentPage !== 'tabs') navigationStore.switchTo('tabs');
      const input = document.querySelector('.search-bar input');
      input?.focus();
    }

    if (e.key === '1' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); navigationStore.switchTo('tabs'); }
    if (e.key === '2' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); navigationStore.switchTo('workspaces'); }
    if (e.key === '3' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); navigationStore.switchTo('history'); }
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

{#if modalStore.active === 'share'}
  <ShareModal
    onclose={() => modalStore.close()}
    onlinkCreated={(url) => modalStore.open('shareLink', { url })}
  />
{/if}

{#if modalStore.active === 'shareLink'}
  <ShareLinkModal
    url={modalStore.props.url}
    onclose={() => modalStore.close()}
  />
{/if}

{#if modalStore.active === 'restoreWorkspace'}
  <RestoreWorkspaceModal
    workspaceId={modalStore.props.workspaceId}
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
