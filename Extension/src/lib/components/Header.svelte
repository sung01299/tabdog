<script>
  import { themeStore } from '../stores/theme.svelte.js';
  import { authStore } from '../stores/auth.svelte.js';
  import UserDropdown from './UserDropdown.svelte';

  let showDropdown = $state(false);

  function handleMenuClick(e) {
    e.stopPropagation();
    showDropdown = !showDropdown;
  }

  function closeDropdown() {
    showDropdown = false;
  }

  $effect(() => {
    function onClickOutside(e) {
      if (!e.target.closest('.user-menu') && !e.target.closest('.user-dropdown')) {
        showDropdown = false;
      }
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  });
</script>

<header class="header">
  <div class="header-left">
    <span class="status-dot connected"></span>
    <img class="app-icon" src="../icons/icon128.png" alt="TabDog">
  </div>
  <div class="header-right">
    <button class="icon-btn" onclick={themeStore.toggle} title={themeStore.isDark ? 'Light mode' : 'Dark mode'}>
      <svg viewBox="0 0 16 16" fill="currentColor">
        {#if themeStore.isDark}
          <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>
        {:else}
          <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
        {/if}
      </svg>
    </button>
    <div class="user-menu">
      <button class="avatar-btn" onclick={handleMenuClick} title="Account">
        <img class="avatar" src={authStore.avatarUrl} alt="User">
      </button>
    </div>
  </div>
</header>

{#if showDropdown}
  <UserDropdown onclose={closeDropdown} />
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--divider-color);
    flex-shrink: 0;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .app-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--warning-color);
    flex-shrink: 0;
  }
  .status-dot.connected {
    background: var(--success-color);
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: 8px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .icon-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .icon-btn svg {
    width: 15px;
    height: 15px;
  }
  .avatar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: none;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }
  .avatar-btn:hover {
    border-color: var(--accent-color);
  }
  .avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
  }
</style>
