<script>
  let {
    light = false,
    expanded = false,
    color = '#007AFF',
    name = '',
    count = '',
    bgHighlight = false,
    showRestore = false,
  } = $props();
</script>

<div class="mock-workspace" class:light style:background={bgHighlight ? `rgba(${hexToRgb(color)}, 0.15)` : 'transparent'}>
  <span class="mock-chevron" class:expanded>{@html '&#9654;'}</span>
  <svg class="mock-ws-icon" viewBox="0 0 16 16" fill={color}>
    <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
  </svg>
  <span class="mock-ws-name">{name}</span>
  <span class="mock-ws-count">{count}</span>
  {#if showRestore}
    <div class="mock-restore-btn">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
        <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
      </svg>
    </div>
  {/if}
</div>

<script module>
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }
</script>

<style>
  .mock-workspace {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .mock-workspace.light { border-bottom: 1px solid rgba(0,0,0,0.08); }
  .mock-chevron {
    font-size: 10px;
    color: #636366;
    display: inline-block;
    transition: transform 0.15s ease;
  }
  .mock-chevron.expanded { transform: rotate(90deg); }
  .mock-ws-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  .mock-ws-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }
  .mock-ws-count {
    font-size: 12px;
    color: #636366;
  }
  .mock-restore-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: rgba(10,132,255,0.2);
    color: #0a84ff;
    margin-left: auto;
  }
</style>
