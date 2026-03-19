import { initAuth, signInWithGoogle, signOut, onAuthStateChanged, getCurrentUser, setCurrentUser } from '../../../services/auth.js';

function createAuthStore() {
  let user = $state(null);
  let loading = $state(true);
  let signingIn = $state(false);

  let initialAuthHandled = false;

  function handleAuthStateChanged(newUser) {
    if (!initialAuthHandled && !newUser && user) {
      initialAuthHandled = true;
      return;
    }
    initialAuthHandled = true;
    user = newUser;
    loading = false;
  }

  return {
    get user() { return user; },
    get loading() { return loading; },
    get signingIn() { return signingIn; },
    get isLoggedIn() { return !!user; },

    get avatarUrl() {
      if (!user) return '';
      return user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=007aff&color=fff`;
    },

    async init() {
      try {
        if (globalThis.chrome?.storage) {
          const cached = await chrome.storage.local.get(['user']);
          if (cached.user) {
            user = cached.user;
            setCurrentUser(cached.user);
          }
        }
      } catch { /* ignore */ }
      loading = false;

      onAuthStateChanged(handleAuthStateChanged);
      initAuth();
    },

    async signIn() {
      signingIn = true;
      try {
        const response = await chrome.runtime.sendMessage({ action: 'signIn' });
        if (response?.error) throw new Error(response.error);
        await initAuth();
      } catch (error) {
        console.error('Sign in failed:', error);
        throw error;
      } finally {
        signingIn = false;
      }
    },

    async signOut() {
      try {
        await chrome.runtime.sendMessage({ action: 'signOut' });
        user = null;
      } catch (error) {
        console.error('Sign out failed:', error);
        throw error;
      }
    },
  };
}

export const authStore = createAuthStore();
