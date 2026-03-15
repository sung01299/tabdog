<script>
  /* Phase 3: Tab list, domain grouping, recently closed */
</script>

<div class="page">
  <div class="scrollable-content">
    <div class="placeholder">
      <svg class="placeholder-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/>
        <path d="M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
      </svg>
      <span>Tabs page — will be implemented in Phase 3</span>
    </div>
  </div>
</div>

<style>
  .page {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
  }
  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    color: var(--text-secondary);
    height: 100%;
    text-align: center;
    font-size: 13px;
  }
  .placeholder-icon {
    width: 32px;
    height: 32px;
    color: var(--text-tertiary);
  }
</style>
