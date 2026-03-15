<script>
  let darkMode = $state(false);

  function toggleTheme() {
    darkMode = !darkMode;
    document.documentElement.classList.toggle('dark', darkMode);
  }
</script>

<div class="flex flex-col h-full" style="background-color: var(--color-bg);">
  <!-- Header -->
  <header class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid var(--color-border);">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-green-500"></div>
      <span class="text-sm font-medium" style="color: var(--color-text);">TabDog</span>
    </div>
    <button
      onclick={toggleTheme}
      class="p-1.5 rounded-lg transition-colors hover:opacity-80"
      style="color: var(--color-text);"
    >
      {#if darkMode}
        <svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
          <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 16 8zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8z"/>
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
          <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
        </svg>
      {/if}
    </button>
  </header>

  <!-- Search Bar -->
  <div class="px-4 py-2" style="border-bottom: 1px solid var(--color-border);">
    <div class="flex items-center gap-2 px-3 py-2 rounded-lg" style="background-color: var(--color-surface);">
      <svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 shrink-0" style="color: var(--color-text-secondary);">
        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
      </svg>
      <span class="text-sm" style="color: var(--color-text-secondary);">Search tabs...</span>
    </div>
  </div>

  <!-- Content Area -->
  <main class="flex-1 overflow-y-auto px-4 py-3">
    <div class="flex flex-col items-center justify-center h-full gap-3 text-center">
      <div class="text-4xl">🐕</div>
      <h2 class="text-lg font-semibold" style="color: var(--color-text);">TabDog is ready</h2>
      <p class="text-sm max-w-[240px]" style="color: var(--color-text-secondary);">
        Svelte 5 + Vite + Tailwind CSS build infrastructure is working.
      </p>
      <div class="flex gap-2 mt-2">
        <span class="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">Svelte 5</span>
        <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">Vite</span>
        <span class="px-2 py-1 text-xs rounded-full bg-cyan-100 text-cyan-700">Tailwind</span>
      </div>
    </div>
  </main>

  <!-- Bottom Navigation -->
  <nav class="flex items-center justify-around px-2 py-2" style="border-top: 1px solid var(--color-border); background-color: var(--color-bg);">
    {#each [
      { label: 'Tabs', icon: 'M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z' },
      { label: 'Spaces', icon: 'M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z' },
      { label: 'History', icon: 'M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z' },
    ] as item, i}
      <button
        class="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors"
        style="color: {i === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)'};"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5">
          <path d={item.icon}/>
        </svg>
        <span class="text-[10px] font-medium">{item.label}</span>
      </button>
    {/each}
  </nav>
</div>
