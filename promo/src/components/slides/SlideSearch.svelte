<script>
  import MockPopup from '../MockPopup.svelte';
  import MockHeader from '../MockHeader.svelte';
  import MockSearchBar from '../MockSearchBar.svelte';
  import MockNavbar from '../MockNavbar.svelte';
  import MockTab from '../MockTab.svelte';
  import { GITHUB_ICON } from '../icons.js';

  const hl = (text) => `<span style="background:rgba(255,214,10,0.35);border-radius:2px;padding:0 1px;">${text}</span>`;
</script>

<p class="slide-label">Slide 2 — Search</p>
<div class="slide slide-search">
  <div class="slide-inner">
    <div class="slide-text">
      <div class="feature-label">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
        INSTANT SEARCH
      </div>
      <div class="feature-title">Find any tab<br>in seconds</div>
      <div class="feature-desc">Search by title, URL, or domain. Results update as you type — no more hunting through windows.</div>
    </div>
    <div class="slide-visual">
      <MockPopup height="480px">
        <MockHeader />
        <MockSearchBar active text="git" showCursor />
        <div class="mock-content">
          <MockTab faviconColor="#333" faviconIcon={GITHUB_ICON} title="{hl('Git')}Hub — sung01299/tabdog" meta="{hl('git')}hub.com" selected />
          <MockTab faviconColor="#333" faviconIcon={GITHUB_ICON} title="{hl('Git')}Hub — Pull Request #42" meta="{hl('git')}hub.com" />
          <MockTab faviconColor="#f05032" faviconLetter="G" title="{hl('Git')} - Documentation" meta="{hl('git')}-scm.com" />
          <div class="results-bar">3 results</div>
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
  .slide-search {
    background: linear-gradient(160deg, #0a0a0a 0%, #1a0a2e 40%, #0f1b3e 100%);
  }
  .slide-inner {
    display: flex; align-items: center; gap: 80px; padding: 0 100px;
  }
  .slide-text {
    display: flex; flex-direction: column; gap: 16px; flex: 1;
  }
  .feature-label {
    display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px;
    background: rgba(255,255,255,0.1); border-radius: 100px; font-size: 14px;
    font-weight: 500; letter-spacing: 0.5px; color: rgba(255,255,255,0.7);
    backdrop-filter: blur(10px);
  }
  .feature-title {
    font-size: 44px; font-weight: 700; letter-spacing: -1px; line-height: 1.2;
  }
  .feature-desc {
    font-size: 20px; color: rgba(255,255,255,0.55); line-height: 1.6; max-width: 380px;
  }
  .mock-content { flex: 1; overflow: hidden; }
  .results-bar {
    padding: 8px 12px; font-size: 11px; color: #636366;
    background: #2c2c2e; border-top: 1px solid rgba(255,255,255,0.08);
  }
</style>
