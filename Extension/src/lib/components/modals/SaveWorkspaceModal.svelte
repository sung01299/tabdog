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

  $effect(() => {
    if (editingWorkspace) {
      name = editingWorkspace.name;
      selectedColor = editingWorkspace.color || 'blue';
      customTabs = editingWorkspace.tabs.map((t, i) => ({
        id: 'existing-' + i, url: t.url, title: t.title || getDomain(t.url),
        favIconUrl: t.favIconUrl || `https://www.google.com/s2/favicons?domain=${getDomain(t.url)}&sz=32`,
      }));
      selectedIds = new Set(customTabs.map(t => t.id));
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

  function removeCustomTab(id) {
    customTabs = customTabs.filter(t => t.id !== id);
    const next = new Set(selectedIds);
    next.delete(id);
    selectedIds = next;
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
    if (e.key === 'Enter') { e.preventDefault(); addCustomUrl(); }
  }
</script>

<Modal title={isEdit ? 'Edit Workspace' : 'Save Workspace'} fullscreen {onclose}>
  <div class="modal-body">
    <div class="form-group">
      <label for="ws-name">Workspace Name</label>
      <input id="ws-name" type="text" class="form-input" placeholder="My Workspace" bind:value={name}>
    </div>

    <div class="form-group">
      <label>Color</label>
      <div class="color-picker">
        {#each COLORS as color}
          <button
            class="color-option"
            class:selected={selectedColor === color.name}
            style="--color: {color.hex}"
            onclick={() => selectedColor = color.name}
          ></button>
        {/each}
      </div>
    </div>

    <div class="form-group">
      <label>Add custom URL</label>
      <div class="url-add-row">
        <input type="text" class="form-input" placeholder="https://example.com" bind:value={customUrlInput} onkeydown={handleUrlKeydown}>
        <button class="btn-add-url" onclick={addCustomUrl}>Add</button>
      </div>
    </div>

    <div class="form-group">
      <div class="tab-select-header">
        <label>Tabs to save</label>
        <button class="select-all-btn" onclick={toggleAll}>{allSelected ? 'Deselect All' : 'Select All'}</button>
      </div>
      <div class="tab-select-list">
        {#each allTabs as tab (tab.id)}
          {@const domain = getDomain(tab.url)}
          {@const isCustom = String(tab.id).startsWith('custom-') || String(tab.id).startsWith('existing-')}
          <label class="tab-select-item" class:custom-tab={isCustom}>
            <input type="checkbox" checked={selectedIds.has(tab.id)} onchange={() => toggleTab(tab.id)}>
            <Favicon src={tab.favIconUrl} alt={domain} />
            <div class="tab-info">
              <span class="tab-title">{tab.title || 'Untitled'}</span>
              <span class="tab-url">{domain}</span>
            </div>
            {#if isCustom}
              <button class="remove-custom-tab" onclick={(e) => { e.preventDefault(); removeCustomTab(tab.id); }}>
                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
              </button>
            {/if}
          </label>
        {/each}
      </div>
    </div>

    <div class="form-info">{selectedCount} tabs selected</div>
  </div>

  <div class="modal-footer">
    <button class="btn btn-secondary" onclick={() => onclose?.()}>Cancel</button>
    <button class="btn btn-primary" onclick={handleSave} disabled={saving}>
      {saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}
    </button>
  </div>
</Modal>

<style>
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--divider-color);
    flex-shrink: 0;
  }
  .form-group { margin-bottom: 16px; }
  .form-group:last-child { margin-bottom: 0; }
  .form-group > label { display: block; font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px; }
  .form-input {
    width: 100%; padding: 10px 12px; font-size: 13px; color: var(--text-primary);
    background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px;
    transition: all 0.15s ease; font-family: inherit; box-sizing: border-box;
  }
  .form-input:focus { outline: none; border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2); }
  .form-info { font-size: 13px; color: var(--text-secondary); margin-top: 12px; padding: 8px 0; border-top: 1px solid var(--divider-color); }
  .btn {
    padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: 10px; cursor: pointer;
    transition: all 0.15s ease; font-family: inherit;
  }
  .btn-primary { background: var(--accent-color); border: none; color: white; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); }
  .btn-secondary:hover { background: var(--bg-tertiary); }
  .color-picker { display: flex; gap: 8px; flex-wrap: wrap; }
  .color-option {
    width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent;
    background: var(--color); cursor: pointer; transition: all 0.15s ease; padding: 0;
  }
  .color-option:hover { transform: scale(1.1); }
  .color-option.selected { border-color: var(--text-primary); box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--color); }
  .url-add-row { display: flex; gap: 8px; }
  .url-add-row .form-input { flex: 1; }
  .btn-add-url {
    padding: 10px 16px; font-size: 13px; font-weight: 500; color: #fff;
    background: var(--accent-color); border: none; border-radius: 10px; cursor: pointer;
    transition: all 0.15s ease; flex-shrink: 0; font-family: inherit;
  }
  .btn-add-url:hover { background: var(--accent-hover); }
  .tab-select-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
  .select-all-btn {
    padding: 4px 10px; font-size: 12px; background: var(--bg-tertiary); border: none;
    border-radius: 6px; color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease; font-family: inherit;
  }
  .select-all-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .tab-select-list { max-height: 250px; overflow-y: auto; border-radius: 10px; background: var(--bg-primary); }
  .tab-select-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    border-bottom: 1px solid var(--divider-color); cursor: pointer; transition: background 0.15s ease;
  }
  .tab-select-item:last-child { border-bottom: none; }
  .tab-select-item:hover { background: var(--bg-hover); }
  .tab-select-item.custom-tab { background: var(--bg-tertiary); }
  .tab-select-item input[type="checkbox"] { width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--accent-color); }
  .tab-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .tab-title { font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tab-url { font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .remove-custom-tab {
    width: 20px; height: 20px; padding: 0; margin-left: auto; background: transparent;
    border: none; color: var(--text-tertiary); cursor: pointer; display: flex;
    align-items: center; justify-content: center; border-radius: 6px; transition: all 0.15s ease; flex-shrink: 0;
  }
  .remove-custom-tab:hover { color: var(--danger-color); background: var(--bg-secondary); }
  .remove-custom-tab svg { width: 14px; height: 14px; }
</style>
