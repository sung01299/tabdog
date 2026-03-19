<script>
  let { light = false, statusText = '23 tabs', showThemeBtn = false } = $props();
</script>

<div class="mock-header" class:light>
  <div class="mock-status">
    <div class="mock-status-dot"></div>
    <span>{statusText}</span>
  </div>
  <div class="mock-header-actions">
    {#if showThemeBtn}
      <div class="mock-header-btn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="#98989d"><path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/></svg>
      </div>
    {/if}
    <div class="mock-avatar"></div>
  </div>
</div>

<style>
  .mock-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #2c2c2e;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  }
  .mock-header.light {
    background: #f5f5f7;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }
  .mock-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #98989d;
  }
  .mock-header.light .mock-status { color: #86868b; }
  .mock-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #30d158;
  }
  .mock-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mock-header-btn {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mock-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: linear-gradient(135deg, #007AFF, #5856D6);
  }
</style>
