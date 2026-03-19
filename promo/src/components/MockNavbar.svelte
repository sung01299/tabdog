<script>
  let { light = false, activePage = 'tabs' } = $props();

  const accentFill = $derived(light ? '#007aff' : '#0a84ff');
  const inactiveFill = $derived(light ? '#aeaeb2' : '#636366');
</script>

<div class="mock-navbar" class:light>
  <div class="mock-nav-item" class:active={activePage === 'tabs'}>
    <svg class="icon-nav" viewBox="0 0 16 16" fill={activePage === 'tabs' ? accentFill : inactiveFill}>
      <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/>
      <path d="M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
    </svg>
    <span class="mock-nav-label" style:color={activePage === 'tabs' ? accentFill : inactiveFill}>Tabs</span>
  </div>
  <div class="mock-nav-item" class:active={activePage === 'workspaces'}>
    <svg class="icon-nav" viewBox="0 0 16 16" fill={activePage === 'workspaces' ? accentFill : inactiveFill}>
      <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
    </svg>
    <span class="mock-nav-label" style:color={activePage === 'workspaces' ? accentFill : inactiveFill}>Spaces</span>
  </div>
  <div class="mock-nav-item" class:active={activePage === 'history'}>
    <svg class="icon-nav" viewBox="0 0 16 16" fill={activePage === 'history' ? accentFill : inactiveFill}>
      <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0v1z"/>
      <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z"/>
    </svg>
    <span class="mock-nav-label" style:color={activePage === 'history' ? accentFill : inactiveFill}>History</span>
  </div>
</div>

<style>
  .mock-navbar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 8px 8px 14px;
    border-top: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  }
  .mock-navbar.light { border-top: 1px solid rgba(0,0,0,0.08); }
  .mock-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 50px;
  }
  .icon-nav { width: 20px; height: 20px; }
  .mock-nav-label {
    font-size: 10px;
    font-weight: 500;
  }
</style>
