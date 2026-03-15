<script>
  import { authStore } from '../stores/auth.svelte.js';

  let error = $state('');

  async function handleSignIn() {
    error = '';
    try {
      await authStore.signIn();
    } catch (e) {
      error = 'Sign in failed. Please try again.';
    }
  }
</script>

<div class="login-screen">
  <div class="login-content">
    <img src="../icons/icon128.png" alt="TabDog" class="login-logo">
    <h1 class="login-title">TabDog</h1>
    <p class="login-subtitle">Sync your tabs across all devices</p>
    <button class="login-btn" onclick={handleSignIn} disabled={authStore.signingIn}>
      {#if authStore.signingIn}
        <div class="btn-spinner"></div>
        Signing in...
      {:else}
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      {/if}
    </button>
    {#if error}
      <p class="login-error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .login-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px 20px;
    text-align: center;
  }
  .login-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .login-logo {
    width: 80px;
    height: 80px;
    margin-bottom: 8px;
  }
  .login-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .login-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 16px 0;
  }
  .login-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .login-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--text-tertiary);
  }
  .login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .login-error {
    margin-top: 8px;
    font-size: 12px;
    color: var(--danger-color);
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
