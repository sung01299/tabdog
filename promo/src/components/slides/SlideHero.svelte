<script>
  import MockPopup from '../MockPopup.svelte';
  import MockHeader from '../MockHeader.svelte';
  import MockSearchBar from '../MockSearchBar.svelte';
  import MockNavbar from '../MockNavbar.svelte';
  import MockTab from '../MockTab.svelte';
  import { GITHUB_ICON } from '../icons.js';
</script>

<p class="slide-label">Slide 1 — Hero</p>
<div class="slide slide-hero">
  <div class="hero-glow"></div>
  <div class="hero-layout">
    <div class="hero-text">
      <div class="hero-brand">
        <img src="../docs/tabdog-icon.png" class="app-icon" alt="TabDog">
        <span class="brand-name">TabDog</span>
      </div>
      <div class="tagline">Manage all your<br>browser tabs<br>in one place</div>
      <div class="subtitle">Search, group by domain, save workspaces, and browse history — all from a single popup.</div>
      <div class="hero-shortcut">
        <span class="kbd">{@html '&#8984;'} Shift E</span>
        <span>to open</span>
      </div>
    </div>
    <div class="slide-visual">
      <MockPopup height="520px">
        <MockHeader showThemeBtn />
        <MockSearchBar />
        <div class="mock-content">
          <MockTab faviconColor="#1a73e8" faviconLetter="G" title="Google Cloud Console — Dashboard" meta="console.cloud.google.com · 3m ago" showDot />
          <MockTab faviconColor="#333" faviconIcon={GITHUB_ICON} title="GitHub — sung01299/tabdog" meta="github.com · 1m ago" selected showDot />
          <MockTab faviconColor="#ff6d00" faviconLetter="S" title="Stack Overflow — Chrome extension tabs API" meta="stackoverflow.com · 8m ago" />
          <MockTab faviconColor="#0a66c2" faviconLetter="L" title="LinkedIn — Feed" meta="linkedin.com · 12m ago" />
          <MockTab faviconColor="#ea4335" faviconLetter="Y" title="YouTube — How to build Chrome Extensions" meta="youtube.com · 15m ago" />
          <MockTab faviconColor="#5865F2" faviconLetter="D" title="Discord — #general" meta="discord.com · 20m ago" />
        </div>
        <MockNavbar activePage="tabs" />
      </MockPopup>
    </div>
  </div>
</div>

<style>
  .slide-label {
    font-size: 14px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: -28px;
  }
  .slide {
    width: 1280px;
    height: 800px;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .slide-hero {
    background: linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 40%, #16213e 100%);
  }
  .hero-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(0, 122, 255, 0.12) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .hero-layout {
    display: flex;
    align-items: center;
    gap: 80px;
    z-index: 1;
  }
  .hero-text {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hero-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 4px;
  }
  .app-icon {
    width: 80px;
    height: 80px;
    border-radius: 18px;
  }
  .brand-name {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  .tagline {
    font-size: 48px;
    font-weight: 700;
    letter-spacing: -1.5px;
    line-height: 1.15;
    text-align: left;
    max-width: 700px;
  }
  .subtitle {
    font-size: 19px;
    font-weight: 400;
    color: rgba(255,255,255,0.6);
    text-align: left;
    max-width: 560px;
    line-height: 1.5;
  }
  .hero-shortcut {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 14px;
    color: rgba(255,255,255,0.4);
  }
  .kbd {
    display: inline-block;
    padding: 4px 10px;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    color: rgba(255,255,255,0.8);
  }
  .mock-content { flex: 1; overflow: hidden; }
</style>
