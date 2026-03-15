<script>
  let { light = false, height = '560px', width = '400px', children } = $props();
</script>

<div class="mock-popup" class:light style="height:{height};width:{width};">
  {@render children()}
</div>

<style>
  .mock-popup {
    background: #1c1c1e;
    border-radius: 12px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.08),
      0 25px 80px rgba(0,0,0,0.5),
      0 10px 30px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    font-size: 13px;
    color: #f5f5f7;
    flex-shrink: 0;
  }
  .mock-popup.light {
    background: #ffffff;
    color: #1d1d1f;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.08),
      0 25px 80px rgba(0,0,0,0.25),
      0 10px 30px rgba(0,0,0,0.15);
  }
</style>
