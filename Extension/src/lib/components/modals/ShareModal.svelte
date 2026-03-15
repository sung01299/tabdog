<script>
  import Modal from '../Modal.svelte';
  import { tabsStore } from '../../stores/tabs.svelte.js';
  import { createShareLink, EXPIRATION_OPTIONS } from '../../../../services/share.js';

  let { onclose, onlinkCreated } = $props();

  let title = $state('');
  let expiration = $state('7_days');
  let creating = $state(false);

  async function handleCreate() {
    creating = true;
    try {
      const result = await createShareLink(tabsStore.tabs, { title: title.trim() || undefined, expiration });
      onclose?.();
      onlinkCreated?.(result.url);
    } catch (e) {
      console.error('Failed to create share link:', e);
      alert('Failed to create share link: ' + e.message);
    } finally {
      creating = false;
    }
  }
</script>

<Modal title="Share Tabs" {onclose}>
  <div class="modal-body">
    <div class="form-group">
      <label for="share-title">Title (optional)</label>
      <input id="share-title" type="text" class="form-input" placeholder="My shared tabs" bind:value={title}>
    </div>
    <div class="form-group">
      <label for="share-exp">Expires</label>
      <select id="share-exp" class="form-select" bind:value={expiration}>
        <option value="7_days">In 7 days</option>
        <option value="1_day">In 1 day</option>
        <option value="30_days">In 30 days</option>
        <option value="never">Never</option>
      </select>
    </div>
    <div class="form-info">{tabsStore.tabs.length} tabs will be shared</div>
  </div>
  <div class="modal-footer">
    <button class="btn btn-secondary" onclick={() => onclose?.()}>Cancel</button>
    <button class="btn btn-primary" onclick={handleCreate} disabled={creating}>
      {creating ? 'Creating...' : 'Create Link'}
    </button>
  </div>
</Modal>

<style>
  .modal-body { padding: 16px; }
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 16px; border-top: 1px solid var(--divider-color);
  }
  .form-group { margin-bottom: 16px; }
  .form-group:last-child { margin-bottom: 0; }
  .form-group > label { display: block; font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px; }
  .form-input, .form-select {
    width: 100%; padding: 10px 12px; font-size: 13px; color: var(--text-primary);
    background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px;
    transition: all 0.15s ease; font-family: inherit; box-sizing: border-box;
  }
  .form-input:focus, .form-select:focus { outline: none; border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2); }
  .form-info { font-size: 13px; color: var(--text-secondary); margin-top: 12px; padding: 8px 0; border-top: 1px solid var(--divider-color); }
  .btn { padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: 10px; cursor: pointer; transition: all 0.15s ease; font-family: inherit; }
  .btn-primary { background: var(--accent-color); border: none; color: white; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); }
  .btn-secondary:hover { background: var(--bg-tertiary); }
</style>
