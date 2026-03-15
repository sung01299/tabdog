<script>
  import { workspacesStore } from '../stores/workspaces.svelte.js';
  import WorkspaceCard from '../components/WorkspaceCard.svelte';

  async function handleDelete(id) {
    if (confirm('Delete this workspace?')) {
      await workspacesStore.delete(id);
    }
  }

  function handleEdit(id) {
    // Phase 4: will open SaveWorkspaceModal in edit mode
    console.log('[TODO Phase 4] Edit workspace:', id);
  }

  async function handleRestore(id) {
    try {
      await workspacesStore.restore(id);
    } catch (e) {
      console.error('Failed to restore workspace:', e);
      alert('Failed to restore workspace');
    }
  }

  function handleNewWorkspace() {
    // Phase 4: will open SaveWorkspaceModal
    console.log('[TODO Phase 4] New workspace');
  }
</script>

<div class="page">
  <div class="scrollable-content">
    {#if workspacesStore.workspaces.length === 0}
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
        </svg>
        <span>No Workspaces</span>
      </div>
    {:else}
      <div class="workspaces-list">
        {#each workspacesStore.workspaces as workspace (workspace.id)}
          <WorkspaceCard
            {workspace}
            expanded={workspacesStore.isExpanded(workspace.id)}
            ontoggle={(id) => workspacesStore.toggleExpanded(id)}
            onrestore={handleRestore}
            onedit={handleEdit}
            ondelete={handleDelete}
          />
        {/each}
      </div>
    {/if}
    <div class="add-workspace-row">
      <button class="add-workspace-btn" onclick={handleNewWorkspace}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
        <span>New Workspace</span>
      </button>
    </div>
  </div>
</div>

<style>
  .page {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
  }
  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .scrollable-content::-webkit-scrollbar {
    width: 6px;
  }
  .scrollable-content::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollable-content::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    color: var(--text-secondary);
    height: calc(100% - 60px);
  }
  .empty-icon {
    width: 32px;
    height: 32px;
    color: var(--text-tertiary);
  }
  .add-workspace-row {
    padding: 10px 12px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .add-workspace-row:hover {
    opacity: 1;
  }
  .add-workspace-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: 1px dashed var(--border-color);
    border-radius: 10px;
    color: var(--text-tertiary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  .add-workspace-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }
  .add-workspace-btn svg {
    width: 14px;
    height: 14px;
  }
</style>
