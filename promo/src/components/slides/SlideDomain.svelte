<script>
  import MockPopup from '../MockPopup.svelte';
  import MockHeader from '../MockHeader.svelte';
  import MockSearchBar from '../MockSearchBar.svelte';
  import MockNavbar from '../MockNavbar.svelte';
  import MockTab from '../MockTab.svelte';
  import MockDomainHeader from '../MockDomainHeader.svelte';
  import { GITHUB_ICON_SM } from '../icons.js';
</script>

<p class="slide-label">Slide 3 — Domain Grouping</p>
<div class="slide slide-domain">
  <div class="slide-inner">
    <div class="slide-text">
      <div class="feature-label">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>
        DOMAIN GROUPING
      </div>
      <div class="feature-title">Tabs organized<br>by website</div>
      <div class="feature-desc">Automatically group tabs by domain. Expand, collapse, or close all tabs in a group with one click.</div>
    </div>
    <div class="slide-visual">
      <MockPopup height="480px">
        <MockHeader />
        <MockSearchBar />
        <div class="mock-content">
          <MockDomainHeader expanded faviconColor="#333" faviconIcon={GITHUB_ICON_SM} domain="github.com" count={4} />
          <MockTab indent title="sung01299/tabdog — main" meta="1m ago" faviconColor="" faviconLetter="" showDot />
          <MockTab indent title="Pull Request #42 — Add workspace sync" meta="5m ago" faviconColor="" faviconLetter="" />
          <MockTab indent title="Issues — Feature requests" meta="10m ago" faviconColor="" faviconLetter="" />
          <MockDomainHeader faviconColor="#1a73e8" faviconLetter="G" domain="google.com" count={5} />
          <MockDomainHeader faviconColor="#f48024" faviconLetter="S" domain="stackoverflow.com" count={3} />
          <MockDomainHeader faviconColor="#ff0000" faviconLetter="Y" domain="youtube.com" count={2} />
        </div>
        <MockNavbar activePage="tabs" />
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
  .slide-domain {
    background: linear-gradient(160deg, #0a0a0a 0%, #0a1a0a 40%, #0f2e1b 100%);
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
</style>
