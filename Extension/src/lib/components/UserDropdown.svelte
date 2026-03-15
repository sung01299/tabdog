<script>
  import { authStore } from '../stores/auth.svelte.js';

  let { onclose } = $props();
  let signingOut = $state(false);

  async function handleSignOut() {
    signingOut = true;
    try {
      await authStore.signOut();
      onclose?.();
    } catch {
      // error logged in store
    } finally {
      signingOut = false;
    }
  }
</script>

<div class="user-dropdown">
  <div class="user-dropdown-header">
    <img class="user-dropdown-avatar" src={authStore.avatarUrl} alt="User">
    <div class="user-dropdown-info">
      <div class="user-dropdown-name">{authStore.user?.displayName || 'User'}</div>
      <div class="user-dropdown-email">{authStore.user?.email || ''}</div>
    </div>
  </div>
  <div class="user-dropdown-divider"></div>
  <button class="user-dropdown-item" onclick={handleSignOut} disabled={signingOut}>
    {#if signingOut}
      <div class="btn-spinner"></div>
      Signing out...
    {:else}
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
        <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
      </svg>
      Sign out
    {/if}
  </button>
</div>

<style>
  .user-dropdown {
    position: absolute;
    top: 44px;
    right: 8px;
    width: 220px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    overflow: hidden;
  }
  .user-dropdown-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
  }
  .user-dropdown-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }
  .user-dropdown-info {
    flex: 1;
    min-width: 0;
  }
  .user-dropdown-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .user-dropdown-email {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .user-dropdown-divider {
    height: 1px;
    background: var(--divider-color);
  }
  .user-dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-primary);
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: left;
  }
  .user-dropdown-item:hover {
    background: var(--bg-hover);
  }
  .user-dropdown-item svg {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }
  .user-dropdown-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
