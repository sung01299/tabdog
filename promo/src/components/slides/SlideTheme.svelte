<script>
  import MockPopup from '../MockPopup.svelte';
  import MockHeader from '../MockHeader.svelte';
  import MockNavbar from '../MockNavbar.svelte';
  import MockHistoryItem from '../MockHistoryItem.svelte';
  import { GITHUB_ICON } from '../icons.js';
</script>

<p class="slide-label">Slide 6 — Dark & Light Mode</p>
<div class="slide slide-theme">
  <div class="theme-header">
    <div class="feature-label">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/></svg>
      HISTORY & THEMING
    </div>
    <div class="feature-title">Browse history.<br>Your preferred theme.</div>
    <div class="feature-desc">View your last 7 days of browsing history with search and date grouping. Matches your system theme — or toggle manually.</div>
  </div>
  <div class="theme-popups">
    <!-- Dark mode -->
    <div class="popup-wrapper">
      <MockPopup height="420px">
        <MockHeader />
        <div class="mock-content">
          <div class="mock-history-date">Today</div>
          <MockHistoryItem faviconColor="#333" faviconIcon={GITHUB_ICON} title="GitHub — tabdog repository" domain="github.com" time="2:34 PM" />
          <MockHistoryItem faviconColor="#1a73e8" faviconLetter="G" title="Chrome Web Store — Developer" domain="chrome.google.com" time="1:20 PM" />
          <MockHistoryItem faviconColor="#ff6d00" faviconLetter="S" title="Stack Overflow — Manifest V3" domain="stackoverflow.com" time="12:45 PM" />
          <div class="mock-history-date">Yesterday</div>
          <MockHistoryItem faviconColor="#ea4335" faviconLetter="Y" title="YouTube — Chrome Extension Tutorial" domain="youtube.com" time="8:15 PM" />
        </div>
        <MockNavbar activePage="history" />
      </MockPopup>
      <div class="theme-label">Dark Mode</div>
    </div>
    <!-- Light mode -->
    <div class="popup-wrapper">
      <MockPopup light height="420px">
        <MockHeader light />
        <div class="mock-content">
          <div class="mock-history-date light">Today</div>
          <MockHistoryItem light faviconColor="#333" faviconIcon={GITHUB_ICON} title="GitHub — tabdog repository" domain="github.com" time="2:34 PM" />
          <MockHistoryItem light faviconColor="#1a73e8" faviconLetter="G" title="Chrome Web Store — Developer" domain="chrome.google.com" time="1:20 PM" />
          <MockHistoryItem light faviconColor="#ff6d00" faviconLetter="S" title="Stack Overflow — Manifest V3" domain="stackoverflow.com" time="12:45 PM" />
          <div class="mock-history-date light">Yesterday</div>
          <MockHistoryItem light faviconColor="#ea4335" faviconLetter="Y" title="YouTube — Chrome Extension Tutorial" domain="youtube.com" time="8:15 PM" />
        </div>
        <MockNavbar light activePage="history" />
      </MockPopup>
      <div class="theme-label">Light Mode</div>
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
    flex-direction: column; gap: 40px;
  }
  .slide-theme {
    background: linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 40%, #2a2a2a 100%);
  }
  .theme-header {
    display: flex; flex-direction: column; align-items: center; gap: 16px; z-index: 1;
  }
  .feature-label {
    display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px;
    background: rgba(255,255,255,0.1); border-radius: 100px; font-size: 14px;
    font-weight: 500; letter-spacing: 0.5px; color: rgba(255,255,255,0.7);
    backdrop-filter: blur(10px);
  }
  .feature-title {
    font-size: 44px; font-weight: 700; letter-spacing: -1px; line-height: 1.15; text-align: center;
  }
  .feature-desc {
    font-size: 20px; color: rgba(255,255,255,0.55); line-height: 1.6;
    max-width: 520px; text-align: center;
  }
  .theme-popups {
    display: flex; gap: 40px; z-index: 1;
  }
  .theme-popups :global(.mock-popup) {
    transform: scale(0.95);
  }
  .popup-wrapper { position: relative; }
  .theme-label {
    position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%);
    font-size: 13px; color: #636366; white-space: nowrap;
  }
  .mock-content { flex: 1; overflow: hidden; }
  .mock-history-date {
    padding: 8px 12px; font-size: 11px; font-weight: 600;
    color: #98989d; background: #2c2c2e; text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .mock-history-date.light {
    background: #f5f5f7; color: #86868b;
  }
</style>
