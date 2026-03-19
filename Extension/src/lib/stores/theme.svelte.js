function createThemeStore() {
  let theme = $state('light');

  function apply() {
    const root = document.documentElement;
    root.classList.remove('light-mode', 'dark-mode');
    root.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
  }

  return {
    get current() { return theme; },
    get isDark() { return theme === 'dark'; },

    async init() {
      try {
        if (globalThis.chrome?.storage) {
          const result = await chrome.storage.local.get(['theme']);
          if (result.theme) theme = result.theme;
        }
      } catch (e) {
        console.error('Failed to load theme:', e);
      }
      apply();
    },

    toggle() {
      theme = theme === 'light' ? 'dark' : 'light';
      apply();
      try {
        globalThis.chrome?.storage?.local.set({ theme });
      } catch { /* ignore */ }
    },
  };
}

export const themeStore = createThemeStore();
