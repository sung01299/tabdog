<script>
  import Modal from '../Modal.svelte';
  import { workspacesStore } from '../../stores/workspaces.svelte.js';

  let { workspaceId, onclose } = $props();

  const workspace = $derived(workspacesStore.workspaces.find(w => w.id === workspaceId));

  async function handleRestore() {
    try {
      await workspacesStore.restore(workspaceId);
      onclose?.();
    } catch (e) {
      console.error('Failed to restore workspace:', e);
      alert('Failed to restore workspace');
    }
  }
</script>

{#if workspace}
  <Modal title="Restore Workspace" {onclose}>
    <div class="modal-body">
      <p class="modal-text">How would you like to restore "{workspace.name}"?</p>
      <div class="restore-options">
        <button class="restore-option" onclick={handleRestore}>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
          <span>Add to current tabs</span>
        </button>
        <button class="restore-option" onclick={handleRestore}>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
          </svg>
          <span>Replace current tabs</span>
        </button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .modal-body { padding: 16px; }
  .modal-text { font-size: 13px; color: var(--text-secondary); margin: 0 0 12px 0; }
  .restore-options { display: flex; flex-direction: column; gap: 8px; }
  .restore-option {
    display: flex; align-items: center; gap: 10px; padding: 12px;
    background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 10px;
    cursor: pointer; transition: all 0.15s ease; font-family: inherit;
  }
  .restore-option:hover { background: var(--bg-tertiary); border-color: var(--accent-color); }
  .restore-option svg { width: 16px; height: 16px; color: var(--accent-color); }
  .restore-option span { font-size: 13px; color: var(--text-primary); }
</style>
