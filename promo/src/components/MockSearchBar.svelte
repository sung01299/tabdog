<script>
  let { light = false, active = false, text = 'Search tabs...', showCursor = false } = $props();
</script>

<div class="mock-search" class:light class:active>
  <svg class="icon-search" viewBox="0 0 16 16" fill={active ? '#0a84ff' : '#636366'}>
    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
  </svg>
  <span class="mock-search-text" class:active>{text}</span>
  {#if showCursor}
    <span class="cursor-blink"></span>
  {/if}
</div>

<style>
  .mock-search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #2c2c2e;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  }
  .mock-search.light {
    background: #f5f5f7;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }
  .icon-search { width: 14px; height: 14px; flex-shrink: 0; }
  .mock-search-text {
    color: #636366;
    font-size: 13px;
  }
  .mock-search-text.active { color: #f5f5f7; }
  .mock-search.light .mock-search-text.active { color: #1d1d1f; }
  .cursor-blink {
    display: inline-block;
    width: 1px;
    height: 16px;
    background: #0a84ff;
    animation: blink 1s infinite;
    margin-left: -2px;
  }
</style>
