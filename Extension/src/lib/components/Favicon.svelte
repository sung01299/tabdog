<script>
  let { src = '', alt = '' } = $props();
  let failed = $state(false);
</script>

{#if src && !failed}
  <img class="favicon" {src} {alt} onerror={() => failed = true}>
{:else}
  <svg class="favicon default" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z"/>
  </svg>
{/if}

<style>
  .favicon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border-radius: 4px;
    object-fit: contain;
    background: rgba(128, 128, 128, 0.1);
    padding: 2px;
    box-sizing: content-box;
  }
  .favicon.default {
    color: var(--text-secondary);
    background: none;
    padding: 0;
  }
</style>
