<script>
  let {
    light = false,
    faviconColor = '#333',
    faviconLetter = '',
    faviconIcon = '',
    title = '',
    meta = '',
    selected = false,
    highlighted = false,
    showDot = false,
    indent = false,
    children,
  } = $props();
</script>

<div class="mock-tab" class:light class:selected class:highlighted class:indent>
  {#if faviconColor || faviconLetter || faviconIcon}
    <div class="mock-favicon" style="background:{faviconColor};">
      {#if faviconIcon}
        {@html faviconIcon}
      {:else}
        {faviconLetter}
      {/if}
    </div>
  {/if}
  <div class="mock-tab-info">
    <span class="mock-tab-title">{@html title}</span>
    <span class="mock-tab-meta">{@html meta}</span>
  </div>
  {#if showDot}
    <div class="mock-tab-dot"></div>
  {/if}
</div>

<style>
  .mock-tab {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .mock-tab.light { border-bottom: 1px solid rgba(0,0,0,0.08); }
  .mock-tab.selected { background: rgba(10, 132, 255, 0.2); }
  .mock-tab.light.selected { background: rgba(0, 122, 255, 0.12); }
  .mock-tab.highlighted { background: rgba(10, 132, 255, 0.08); }
  .mock-tab.indent { padding-left: 20px; }
  .mock-favicon {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
  }
  .mock-tab-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mock-tab-title {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mock-tab-meta {
    font-size: 11px;
    color: #98989d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mock-tab.light .mock-tab-meta { color: #86868b; }
  .mock-tab-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #0a84ff;
    flex-shrink: 0;
  }
</style>
