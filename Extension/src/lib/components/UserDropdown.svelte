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
  <div class="dropdown-header">
    <img class="avatar" src={authStore.avatarUrl} alt="User">
    <div class="user-info">
      <span class="user-name">{authStore.user?.displayName || 'User'}</span>
      <span class="user-email">{authStore.user?.email || ''}</span>
    </div>
  </div>
  <div class="divider"></div>
  <button class="dropdown-item" onclick={handleSignOut} disabled={signingOut}>
    {#if signingOut}
      <div class="spinner"></div>
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
    top: 48px;
    right: 10px;
    width: 220px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 100;
    overflow: hidden;
  }
  .dropdown-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
  }
  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
  }
  .user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .user-email {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .divider {
    height: 1px;
    background: var(--divider-color);
    margin: 0 10px;
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--text-primary);
    background: none;
    border: none;
    cursor: pointer;
    transition: background 0.1s ease;
    text-align: left;
    font-family: inherit;
  }
  .dropdown-item:hover {
    background: var(--bg-hover);
  }
  .dropdown-item svg {
    width: 14px;
    height: 14px;
    color: var(--text-tertiary);
  }
  .dropdown-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .spinner {
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
