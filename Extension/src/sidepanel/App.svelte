<script>
  import { onMount } from 'svelte';

  let darkMode = $state(false);

  onMount(async () => {
    const result = await chrome.storage.local.get('theme');
    darkMode = result.theme === 'dark';
    if (darkMode) document.documentElement.classList.add('dark-mode');

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.theme) {
        darkMode = changes.theme.newValue === 'dark';
        document.documentElement.classList.toggle('dark-mode', darkMode);
      }
    });
  });
</script>

<div class="sidepanel-container">
  <header class="sidepanel-header">
    <div class="header-title">
      <svg class="logo" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
        <path d="M6.5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-7.46 3.08a.5.5 0 0 1 .692-.138c.36.226.926.394 1.636.519C7.074 9.584 7.973 9.64 8 9.64c.027 0 .926-.056 1.632-.181.71-.125 1.276-.293 1.636-.519a.5.5 0 0 1 .554.832C11.162 10.2 10.428 10.4 9.67 10.54 8.91 10.68 8.186 10.74 8 10.74s-.91-.06-1.67-.2c-.758-.14-1.492-.34-2.152-.77a.5.5 0 0 1-.138-.692z"/>
      </svg>
      <span>TabDog Chat</span>
    </div>
  </header>

  <main class="sidepanel-content">
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2>Chat with your tabs</h2>
      <p>Select a tab and start asking questions about its content.</p>
      <p class="setup-hint">Set up your API key in settings to get started.</p>
    </div>
  </main>
</div>

<style>
  .sidepanel-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sidepanel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider-color);
    background: var(--bg-primary);
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .logo {
    width: 20px;
    height: 20px;
    color: var(--accent-color);
  }

  .sidepanel-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px;
    text-align: center;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--text-tertiary);
    margin-bottom: 8px;
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .empty-state h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 240px;
    line-height: 1.5;
  }

  .setup-hint {
    margin-top: 4px;
    font-size: 12px !important;
    color: var(--text-tertiary) !important;
  }
</style>
