<script>
  let {
    light = false,
    faviconColor = '#333',
    faviconLetter = '',
    faviconIcon = '',
    title = '',
    domain = '',
    time = '',
  } = $props();
</script>

<div class="mock-history-item" class:light>
  <div class="mock-favicon" style="background:{faviconColor};">
    {#if faviconIcon}
      {@html faviconIcon}
    {:else}
      {faviconLetter}
    {/if}
  </div>
  <div class="mock-tab-info">
    <span class="mock-tab-title" class:light>{title}</span>
    <span class="mock-tab-meta">{domain}</span>
  </div>
  <span class="mock-history-time" class:light>{time}</span>
</div>

<style>
  .mock-history-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .mock-history-item.light { border-bottom: 1px solid rgba(0,0,0,0.08); }
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
  .mock-tab-title.light { color: #1d1d1f; }
  .mock-tab-meta {
    font-size: 11px;
    color: #98989d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mock-history-time {
    font-size: 11px;
    color: #636366;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .mock-history-time.light { color: #86868b; }
</style>
