<script>
  import Modal from '../Modal.svelte';
  import Favicon from '../Favicon.svelte';
  import { tabsStore } from '../../stores/tabs.svelte.js';
  import { workspacesStore } from '../../stores/workspaces.svelte.js';
  import { getDomain } from '../../utils.js';

  let { editWorkspaceId = null, onclose } = $props();

  const COLORS = [
    { name: 'blue', hex: '#007AFF' },
    { name: 'purple', hex: '#AF52DE' },
    { name: 'pink', hex: '#FF2D55' },
    { name: 'red', hex: '#FF3B30' },
    { name: 'orange', hex: '#FF9500' },
    { name: 'yellow', hex: '#FFCC00' },
    { name: 'green', hex: '#34C759' },
    { name: 'teal', hex: '#5AC8FA' },
    { name: 'gray', hex: '#8E8E93' },
  ];

  const isEdit = $derived(!!editWorkspaceId);
  const editingWorkspace = $derived(
    editWorkspaceId ? workspacesStore.workspaces.find(w => w.id === editWorkspaceId) : null
  );

  let name = $state('');
  let selectedColor = $state('blue');
  let selectedIds = $state(new Set());
  let customTabs = $state([]);
  let customUrlInput = $state('');
  let saving = $state(false);
  let suggestions = $state([]);
  let showSuggestions = $state(false);
  let urlInputEl;

  async function updateSuggestions(query) {
    if (!query || query.length < 2) {
      suggestions = [];
      showSuggestions = false;
      return;
    }

    const q = query.toLowerCase();
    const alreadyAdded = new Set(allTabs.map(t => t.url));
    let results = [];

    const tabMatches = tabsStore.tabs
      .filter(t => !alreadyAdded.has(t.url))
      .filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.url?.toLowerCase().includes(q) ||
        t.domain?.toLowerCase().includes(q)
      )
      .map(t => ({ url: t.url, title: t.title, favIconUrl: t.favIconUrl, domain: t.domain }));
    results.push(...tabMatches);

    if (globalThis.chrome?.history) {
      try {
        const historyItems = await chrome.history.search({ text: query, maxResults: 10 });
        const historyMatches = historyItems
          .filter(h => h.url && !alreadyAdded.has(h.url) && !results.some(r => r.url === h.url))
          .map(h => ({
            url: h.url,
            title: h.title || getDomain(h.url),
            favIconUrl: `https://www.google.com/s2/favicons?domain=${getDomain(h.url)}&sz=32`,
            domain: getDomain(h.url),
          }));
        results.push(...historyMatches);
      } catch { /* ignore */ }
    }

    suggestions = results.slice(0, 4);
    showSuggestions = suggestions.length > 0;
  }

  function selectSuggestion(s) {
    const id = 'custom-' + Date.now();
    customTabs = [...customTabs, {
      id, url: s.url, title: s.title || s.domain,
      favIconUrl: s.favIconUrl || `https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`,
    }];
    const next = new Set(selectedIds);
    next.add(id);
    selectedIds = next;
    customUrlInput = '';
    suggestions = [];
    showSuggestions = false;
  }

  function handleUrlInput(e) {
    customUrlInput = e.target.value;
    updateSuggestions(e.target.value.trim());
  }

  function handleUrlBlur() {
    setTimeout(() => { showSuggestions = false; }, 150);
  }

  function handleUrlFocus() {
    if (suggestions.length > 0) showSuggestions = true;
  }

  $effect(() => {
    if (editingWorkspace) {
      const tabs = editingWorkspace.tabs.map((t, i) => ({
        id: 'existing-' + i, url: t.url, title: t.title || getDomain(t.url),
        favIconUrl: t.favIconUrl || `https://www.google.com/s2/favicons?domain=${getDomain(t.url)}&sz=32`,
      }));
      name = editingWorkspace.name;
      selectedColor = editingWorkspace.color || 'blue';
      customTabs = tabs;
      selectedIds = new Set(tabs.map(t => t.id));
    } else {
      selectedIds = new Set(tabsStore.tabs.map(t => t.id));
    }
  });

  const allTabs = $derived.by(() => {
    if (isEdit) {
      const existingUrls = new Set(customTabs.map(t => t.url));
      const current = tabsStore.tabs.filter(t => !existingUrls.has(t.url));
      return [...customTabs, ...current];
    }
    return [...customTabs, ...tabsStore.tabs];
  });

  const selectedCount = $derived(selectedIds.size);
  const allSelected = $derived(selectedIds.size === allTabs.length);
  const selectedColorHex = $derived(COLORS.find(c => c.name === selectedColor)?.hex || '#007AFF');

  function toggleTab(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function toggleAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(allTabs.map(t => t.id));
    }
  }

  function addCustomUrl() {
    let url = customUrlInput.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    try { new URL(url); } catch { alert('Please enter a valid URL'); return; }

    const id = 'custom-' + Date.now();
    const domain = getDomain(url);
    customTabs = [...customTabs, {
      id, url, title: domain,
      favIconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    }];
    const next = new Set(selectedIds);
    next.add(id);
    selectedIds = next;
    customUrlInput = '';
  }

  async function handleSave() {
    const finalName = name.trim() || `Workspace ${workspacesStore.workspaces.length + 1}`;
    const selectedTabs = allTabs.filter(t => selectedIds.has(t.id));
    if (selectedTabs.length === 0) { alert('Please select at least one tab'); return; }

    const tabsToSave = selectedTabs.map(t => ({
      url: t.url, title: t.title, favIconUrl: t.favIconUrl, pinned: t.pinned || false,
    }));

    saving = true;
    try {
      if (isEdit) {
        await workspacesStore.update(editWorkspaceId, { name: finalName, color: selectedColor, tabs: tabsToSave });
      } else {
        await workspacesStore.create(finalName, selectedTabs, selectedColor);
      }
      onclose?.();
    } catch (e) {
      console.error('Failed to save workspace:', e);
      alert('Failed to save workspace');
    } finally {
      saving = false;
    }
  }

  function handleUrlKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        selectSuggestion(suggestions[0]);
      } else {
        addCustomUrl();
      }
    }
    if (e.key === 'Escape' && showSuggestions) {
      e.stopPropagation();
      showSuggestions = false;
    }
  }
</script>

<Modal title={isEdit ? 'Edit Workspace' : 'New Workspace'} fullscreen {onclose}>
  <div class="modal-body">
    <section class="section">
      <div class="name-color-row">
        <div class="color-preview" style="background: {selectedColorHex}">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
          </svg>
        </div>
        <input
          type="text"
          class="name-input"
          placeholder="Workspace name"
          bind:value={name}
        >
      </div>
      <div class="color-picker">
        {#each COLORS as color}
          <button
            class="color-dot"
            class:selected={selectedColor === color.name}
            style="--c: {color.hex}"
            onclick={() => selectedColor = color.name}
            title={color.name}
          >
            {#if selectedColor === color.name}
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div class="section-title-row">
          <span class="section-title">Tabs</span>
          <span class="tab-badge">{selectedCount}</span>
        </div>
        <button class="toggle-all-btn" onclick={toggleAll}>
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div class="tab-list-container">
        <div class="url-input-wrapper">
          <div class="url-input-row">
            <svg class="url-icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            <input
              bind:this={urlInputEl}
              type="text"
              class="url-input"
              placeholder="Add custom URL..."
              value={customUrlInput}
              oninput={handleUrlInput}
              onkeydown={handleUrlKeydown}
              onfocus={handleUrlFocus}
              onblur={handleUrlBlur}
            >
            {#if customUrlInput.trim()}
              <button class="url-add-btn" onclick={addCustomUrl}>Add</button>
            {/if}
          </div>
          {#if showSuggestions}
            <div class="suggestions">
              {#each suggestions as s (s.url)}
                <button class="suggestion-item" onmousedown={() => selectSuggestion(s)}>
                  <Favicon src={s.favIconUrl} alt={s.domain} />
                  <div class="suggestion-info">
                    <span class="suggestion-title">{s.title || 'Untitled'}</span>
                    <span class="suggestion-url">{s.domain}</span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="tab-list">
          {#each allTabs as tab (tab.id)}
            {@const domain = getDomain(tab.url)}
            {@const checked = selectedIds.has(tab.id)}
            <label class="tab-row" class:checked>
              <span class="checkbox" class:checked>
                {#if checked}
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>
                  </svg>
                {/if}
              </span>
              <input type="checkbox" class="sr-only" {checked} onchange={() => toggleTab(tab.id)}>
              <Favicon src={tab.favIconUrl} alt={domain} />
              <div class="tab-info">
                <span class="tab-title">{tab.title || 'Untitled'}</span>
                <span class="tab-url">{domain}</span>
              </div>
            </label>
          {/each}
        </div>
      </div>
    </section>
  </div>

  <div class="modal-footer">
    <button class="btn-cancel" onclick={() => onclose?.()}>Cancel</button>
    <button class="btn-save" onclick={handleSave} disabled={saving} style="background: {selectedColorHex}">
      {#if saving}
        Saving...
      {:else}
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/>
        </svg>
        {isEdit ? 'Update Workspace' : 'Save Workspace'}
      {/if}
    </button>
  </div>
</Modal>

<style>
  .modal-body {
    flex: 1;
    overflow: hidden;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
  }

  .section:last-child {
    flex: 1;
    flex-shrink: 1;
    min-height: 0;
  }

  /* ── Name + Color ── */

  .name-color-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .color-preview {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.2s ease;
  }
  .color-preview svg {
    width: 18px;
    height: 18px;
    color: #fff;
  }

  .name-input {
    flex: 1;
    padding: 10px 14px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1.5px solid transparent;
    border-radius: 12px;
    transition: all 0.15s ease;
    font-family: inherit;
    box-sizing: border-box;
  }
  .name-input::placeholder {
    color: var(--text-tertiary);
    font-weight: 400;
  }
  .name-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-primary);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
  }

  .color-picker {
    display: flex;
    gap: 6px;
    justify-content: center;
    padding: 4px 0;
  }

  .color-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2.5px solid transparent;
    background: var(--c);
    cursor: pointer;
    padding: 0;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .color-dot:hover {
    transform: scale(1.15);
  }
  .color-dot.selected {
    border-color: var(--c);
    box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--c);
  }
  .color-dot svg {
    width: 14px;
    height: 14px;
    color: #fff;
  }

  /* ── Tabs section ── */

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .tab-badge {
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-color);
    background: var(--bg-selected);
    border-radius: 100px;
  }

  .toggle-all-btn {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    background: var(--bg-secondary);
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .toggle-all-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .tab-list-container {
    flex: 1;
    min-height: 0;
    border-radius: 12px;
    background: var(--bg-secondary);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Custom URL row ── */

  .url-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--divider-color);
    background: var(--bg-primary);
    transition: background 0.15s ease;
  }

  .url-input-row:focus-within {
    background: var(--bg-selected);
  }

  .url-icon {
    width: 16px;
    height: 16px;
    color: var(--accent-color);
    flex-shrink: 0;
    opacity: 0.6;
    transition: opacity 0.15s ease;
  }

  .url-input-row:focus-within .url-icon {
    opacity: 1;
  }

  .url-input {
    flex: 1;
    padding: 4px 0;
    font-size: 12px;
    color: var(--text-primary);
    background: transparent;
    border: none;
    font-family: inherit;
  }
  .url-input::placeholder {
    color: var(--text-tertiary);
  }
  .url-input:focus {
    outline: none;
  }

  .url-add-btn {
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: var(--accent-color);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: inherit;
    flex-shrink: 0;
  }
  .url-add-btn:hover {
    background: var(--accent-hover);
  }

  /* ── Suggestions dropdown ── */

  .url-input-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0 0 10px 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--divider-color);
    cursor: pointer;
    transition: background 0.1s ease;
    font-family: inherit;
    text-align: left;
  }
  .suggestion-item:last-child {
    border-bottom: none;
  }
  .suggestion-item:hover {
    background: var(--bg-selected);
  }

  .suggestion-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .suggestion-title {
    font-size: 11px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .suggestion-url {
    font-size: 10px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Tab list ── */

  .tab-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .tab-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s ease;
    border-bottom: 1px solid var(--divider-color);
  }
  .tab-row:last-child {
    border-bottom: none;
  }
  .tab-row:hover {
    background: var(--bg-hover);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .checkbox {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    border: 1.5px solid var(--border-color);
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .checkbox.checked {
    background: var(--accent-color);
    border-color: var(--accent-color);
  }
  .checkbox svg {
    width: 12px;
    height: 12px;
    color: #fff;
  }

  .tab-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tab-title {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tab-url {
    font-size: 10px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Footer ── */

  .modal-footer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--divider-color);
    flex-shrink: 0;
  }

  .btn-cancel {
    flex: 1;
    padding: 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .btn-cancel:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-save {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .btn-save:hover {
    filter: brightness(1.1);
  }
  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: none;
  }
  .btn-save svg {
    width: 14px;
    height: 14px;
  }
</style>
