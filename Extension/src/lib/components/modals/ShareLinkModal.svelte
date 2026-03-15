<script>
  import Modal from '../Modal.svelte';

  let { url, onclose } = $props();
  let copied = $state(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
  }
</script>

<Modal title="Share Link Created" {onclose}>
  <div class="modal-body">
    <div class="share-link-container">
      <input type="text" class="form-input" value={url} readonly>
      <button class="btn btn-primary" onclick={handleCopy}>Copy</button>
    </div>
    {#if copied}
      <div class="share-link-copied">Link copied to clipboard!</div>
    {/if}
  </div>
  <div class="modal-footer">
    <button class="btn btn-secondary" onclick={() => onclose?.()}>Done</button>
  </div>
</Modal>

<style>
  .modal-body { padding: 16px; }
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 16px; border-top: 1px solid var(--divider-color);
  }
  .share-link-container { display: flex; gap: 8px; }
  .share-link-container .form-input { flex: 1; }
  .form-input {
    width: 100%; padding: 10px 12px; font-size: 13px; color: var(--text-primary);
    background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 10px;
    font-family: inherit; box-sizing: border-box;
  }
  .share-link-copied {
    margin-top: 8px; padding: 8px; font-size: 12px; color: var(--success-color);
    background: rgba(52, 199, 89, 0.1); border-radius: 6px; text-align: center;
  }
  .btn { padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: 10px; cursor: pointer; transition: all 0.15s ease; font-family: inherit; }
  .btn-primary { background: var(--accent-color); border: none; color: white; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-secondary { background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); }
  .btn-secondary:hover { background: var(--bg-tertiary); }
</style>
