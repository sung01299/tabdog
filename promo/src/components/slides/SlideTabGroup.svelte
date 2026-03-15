<script>
  import MockPopup from '../MockPopup.svelte';
  import MockHeader from '../MockHeader.svelte';
  import MockTab from '../MockTab.svelte';
  import MockWorkspaceItem from '../MockWorkspaceItem.svelte';
  import { GITHUB_ICON } from '../icons.js';
</script>

<p class="slide-label">Slide 5 — Native Tab Groups</p>
<div class="slide slide-tabgroup">
  <div class="slide-inner" style="gap:60px;">
    <div class="slide-text">
      <div class="feature-label">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path d="M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg>
        NEW — NATIVE TAB GROUPS
      </div>
      <div class="feature-title">Workspaces become<br>real tab groups</div>
      <div class="feature-desc">Restore a workspace and it opens as a native Chrome tab group — with your workspace name and color applied to the browser's tab bar.</div>
    </div>
    <div class="slide-visual" style="display:flex;flex-direction:column;gap:24px;align-items:center;">
      <!-- Mock Chrome tab bar -->
      <div class="mock-chrome-bar">
        <div class="chrome-tab-bar">
          <div class="chrome-tab">
            <div class="chrome-tab-favicon" style="background:#1a73e8;">G</div>
            <span class="chrome-tab-title">Gmail</span>
          </div>
          <div class="chrome-tab-group">
            <div class="chrome-group-label">Work — Development</div>
            <div class="chrome-tab grouped">
              <div class="chrome-tab-favicon" style="background:#333;">
                {@html `<svg width="10" height="10" viewBox="0 0 16 16" fill="#fff"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`}
              </div>
              <span class="chrome-tab-title">GitHub — tabdog</span>
            </div>
            <div class="chrome-tab grouped">
              <div class="chrome-tab-favicon" style="background:#1a73e8;">G</div>
              <span class="chrome-tab-title">Firebase Console</span>
            </div>
            <div class="chrome-tab grouped">
              <div class="chrome-tab-favicon" style="background:#ff6d00;">S</div>
              <span class="chrome-tab-title">Stack Overflow</span>
            </div>
          </div>
          <div class="chrome-tab">
            <div class="chrome-tab-favicon" style="background:#ea4335;">Y</div>
            <span class="chrome-tab-title">YouTube</span>
          </div>
        </div>
      </div>
      <!-- Arrow connector -->
      <div class="arrow-connector">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style="transform:rotate(180deg);"><path fill-rule="evenodd" d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"/></svg>
        <span class="arrow-label">Restore</span>
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style="transform:rotate(180deg);"><path fill-rule="evenodd" d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"/></svg>
      </div>
      <!-- Mini TabDog popup -->
      <MockPopup height="auto" width="360px">
        <MockHeader statusText="Spaces" />
        <div class="mock-content">
          <MockWorkspaceItem expanded color="#007AFF" name="Work — Development" count="3 tabs" bgHighlight showRestore />
          <MockTab indent faviconColor="#333" faviconIcon={GITHUB_ICON} title="GitHub — tabdog" meta="github.com" />
          <MockTab indent faviconColor="#1a73e8" faviconLetter="G" title="Firebase Console" meta="console.firebase.google.com" />
          <MockTab indent faviconColor="#ff6d00" faviconLetter="S" title="Stack Overflow — API question" meta="stackoverflow.com" />
        </div>
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
  .slide-tabgroup {
    background: linear-gradient(160deg, #0a0a0a 0%, #0a1a2e 40%, #162e3e 100%);
  }
  .slide-inner { display: flex; align-items: center; gap: 60px; padding: 0 100px; }
  .slide-text { display: flex; flex-direction: column; gap: 16px; flex: 1; }
  .feature-label {
    display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px;
    background: rgba(255,255,255,0.1); border-radius: 100px; font-size: 14px;
    font-weight: 500; letter-spacing: 0.5px; color: rgba(255,255,255,0.7);
    backdrop-filter: blur(10px);
  }
  .feature-title { font-size: 44px; font-weight: 700; letter-spacing: -1px; line-height: 1.2; }
  .feature-desc { font-size: 20px; color: rgba(255,255,255,0.55); line-height: 1.6; max-width: 400px; }
  .mock-content { flex: 1; overflow: hidden; }
  .mock-chrome-bar {
    width: 540px; background: #202124; border-radius: 12px 12px 0 0;
    padding: 8px 8px 0;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.4);
  }
  .chrome-tab-bar { display: flex; align-items: flex-end; gap: 1px; overflow: hidden; }
  .chrome-tab {
    display: flex; align-items: center; gap: 8px; padding: 8px 14px;
    background: #35363a; border-radius: 8px 8px 0 0;
    min-width: 0; max-width: 160px; flex-shrink: 1;
  }
  .chrome-tab.grouped {
    background: rgba(0,122,255,0.15); border-radius: 0; max-width: 140px;
  }
  .chrome-tab-favicon {
    width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 600; color: #fff;
  }
  .chrome-tab-title {
    font-size: 12px; color: #e8eaed; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  .chrome-tab-group {
    display: flex; align-items: flex-end;
    border-bottom: 3px solid #007AFF; border-radius: 8px 8px 0 0;
    overflow: hidden; background: rgba(0,122,255,0.08);
  }
  .chrome-group-label {
    display: flex; align-items: center; padding: 8px 12px;
    font-size: 11px; font-weight: 600; color: #007AFF;
    white-space: nowrap; letter-spacing: 0.2px;
  }
  .arrow-connector {
    display: flex; align-items: center; gap: 12px; color: rgba(255,255,255,0.3);
  }
  .arrow-label {
    font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase;
  }
</style>
