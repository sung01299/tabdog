<script>
  import { fade, fly } from 'svelte/transition';

  let { title, fullscreen = false, onclose, children } = $props();

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onclose?.();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onclose?.();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="modal-overlay"
  class:fullscreen
  onclick={handleOverlayClick}
  transition:fade={{ duration: 150 }}
>
  <div
    class="modal"
    class:modal-lg={fullscreen}
    in:fly={{ y: 10, duration: 200 }}
    out:fade={{ duration: 100 }}
  >
    <div class="modal-header">
      <h3 class="modal-title">{title}</h3>
      <button class="modal-close" onclick={() => onclose?.()}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
    {@render children()}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-overlay.fullscreen {
    background: var(--bg-primary);
  }
  .modal {
    background: var(--bg-primary);
    border-radius: 14px;
    width: 300px;
    max-width: 90%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .modal-lg {
    width: 100%;
    height: 100%;
    max-width: 100%;
    border-radius: 0;
    box-shadow: none;
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--divider-color);
    flex-shrink: 0;
  }
  .modal-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .modal-close {
    padding: 4px;
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
  }
  .modal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .modal-close svg {
    width: 16px;
    height: 16px;
  }
</style>
