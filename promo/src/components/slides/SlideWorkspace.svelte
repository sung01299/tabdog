<script>
  import MockPopup from '../MockPopup.svelte';
  import MockHeader from '../MockHeader.svelte';
  import MockSearchBar from '../MockSearchBar.svelte';
  import MockNavbar from '../MockNavbar.svelte';
  import MockTab from '../MockTab.svelte';
  import MockWorkspaceItem from '../MockWorkspaceItem.svelte';
  import { GITHUB_ICON } from '../icons.js';
</script>

<p class="slide-label">Slide 4 — Workspaces</p>
<div class="slide slide-workspace">
  <div class="slide-inner">
    <div class="slide-text">
      <div class="feature-label">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/></svg>
        WORKSPACES
      </div>
      <div class="feature-title">Save & restore<br>your tab sets</div>
      <div class="feature-desc">Save your current tabs as a named workspace with color labels. Restore anytime — add to current window or replace all tabs.</div>
    </div>
    <div class="slide-visual">
      <MockPopup height="480px">
        <MockHeader />
        <MockSearchBar text="Search workspaces..." />
        <div class="mock-content">
          <MockWorkspaceItem expanded color="#007AFF" name="Work — Development" count="8 tabs" bgHighlight />
          <MockTab indent faviconColor="#333" faviconIcon={GITHUB_ICON} title="GitHub — tabdog/main" meta="github.com" />
          <MockTab indent faviconColor="#1a73e8" faviconLetter="G" title="Firebase Console" meta="console.firebase.google.com" />
          <MockWorkspaceItem color="#34C759" name="Research — AI/ML" count="12 tabs" />
          <MockWorkspaceItem color="#AF52DE" name="Side Project — Portfolio" count="5 tabs" />
          <MockWorkspaceItem color="#FF9500" name="Shopping — Wishlist" count="3 tabs" />
          <div class="new-ws-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
            New Workspace
          </div>
        </div>
        <MockNavbar activePage="workspaces" />
      </MockPopup>
    </div>
  </div>
</div>

<style>
  .slide-label {
    font-size: 14px; color: #666; text-transform: uppercase;
    letter-spacing: 2px; margin-bottom: -28px;
  }
  .slide {
    width: 1280px; height: 800px; border-radius: 16px; overflow: hidden;
    position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .slide-workspace {
    background: linear-gradient(160deg, #0a0a0a 0%, #2e1a0a 40%, #3e2516 100%);
  }
  .slide-inner { display: flex; align-items: center; gap: 80px; padding: 0 100px; }
  .slide-text { display: flex; flex-direction: column; gap: 16px; flex: 1; }
  .feature-label {
    display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px;
    background: rgba(255,255,255,0.1); border-radius: 100px; font-size: 14px;
    font-weight: 500; letter-spacing: 0.5px; color: rgba(255,255,255,0.7);
    backdrop-filter: blur(10px);
  }
  .feature-title { font-size: 44px; font-weight: 700; letter-spacing: -1px; line-height: 1.2; }
  .feature-desc { font-size: 20px; color: rgba(255,255,255,0.55); line-height: 1.6; max-width: 380px; }
  .mock-content { flex: 1; overflow: hidden; }
  .new-ws-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    margin: 10px 12px; padding: 10px 12px;
    border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px;
    color: #636366; font-size: 13px;
  }
</style>
