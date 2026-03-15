<script>
  let {
    light = false,
    expanded = false,
    faviconColor = '#333',
    faviconLetter = '',
    faviconIcon = '',
    domain = '',
    count = 0,
  } = $props();
</script>

<div class="mock-domain-header" class:light>
  <span class="mock-chevron" class:expanded>{@html '&#9654;'}</span>
  <div class="mock-domain-favicon" style="background:{faviconColor};">
    {#if faviconIcon}
      {@html faviconIcon}
    {:else}
      {faviconLetter}
    {/if}
  </div>
  <span class="mock-domain-name">{domain}</span>
  <span class="mock-domain-count" class:light>{count}</span>
</div>

<style>
  .mock-domain-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #2c2c2e;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .mock-domain-header.light {
    background: #f5f5f7;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }
  .mock-chevron {
    color: #636366;
    font-size: 10px;
    display: inline-block;
    transition: transform 0.15s ease;
  }
  .mock-chevron.expanded { transform: rotate(90deg); }
  .mock-domain-favicon {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: #fff;
  }
  .mock-domain-name {
    flex: 1;
    font-weight: 500;
    font-size: 13px;
  }
  .mock-domain-count {
    padding: 2px 8px;
    font-size: 11px;
    color: #98989d;
    background: #3a3a3c;
    border-radius: 10px;
  }
  .mock-domain-count.light {
    background: #e8e8ed;
    color: #86868b;
  }
</style>
