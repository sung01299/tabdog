<script>
  import { themeStore } from './lib/stores/theme.svelte.js';
  import { authStore } from './lib/stores/auth.svelte.js';
  import { navigationStore } from './lib/stores/navigation.svelte.js';

  import LoginScreen from './lib/pages/LoginScreen.svelte';
  import Header from './lib/components/Header.svelte';
  import SearchBar from './lib/components/SearchBar.svelte';
  import BottomNav from './lib/components/BottomNav.svelte';
  import TabsPage from './lib/pages/TabsPage.svelte';
  import WorkspacesPage from './lib/pages/WorkspacesPage.svelte';
  import HistoryPage from './lib/pages/HistoryPage.svelte';

  let searchQuery = $state('');

  $effect(() => {
    themeStore.init();
    authStore.init();
  });
</script>

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
        {#if navigationStore.currentPage === 'tabs'}
          <TabsPage {searchQuery} />
        {:else if navigationStore.currentPage === 'workspaces'}
          <WorkspacesPage />
        {:else if navigationStore.currentPage === 'history'}
          <HistoryPage />
        {/if}
      </div>

      <BottomNav />
    </div>
  {/if}
</div>

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
</style>
