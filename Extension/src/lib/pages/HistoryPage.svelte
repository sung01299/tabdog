<script>
  /* Phase 3: History list grouped by date, search */
</script>

<div class="page">
  <div class="scrollable-content">
    <div class="placeholder">
      <svg class="placeholder-icon" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
        <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/>
      </svg>
      <span>History page — will be implemented in Phase 3</span>
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
