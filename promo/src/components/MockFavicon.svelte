<script>
  let { color = '#333', letter = '', icon = '', size = 20 } = $props();
</script>

<div class="mock-favicon" style="background:{color};width:{size}px;height:{size}px;border-radius:{Math.round(size * 0.2)}px;">
  {#if icon}
    {@html icon}
  {:else}
    {letter}
  {/if}
</div>

<style>
  .mock-favicon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
  }
</style>
