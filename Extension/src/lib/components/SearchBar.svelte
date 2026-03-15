<script>
  let { value = $bindable(''), placeholder = 'Search tabs...', oninput, autofocus = false } = $props();

  let inputEl;

  export function focus() {
    inputEl?.focus();
  }

  function handleClear() {
    value = '';
    oninput?.('');
    inputEl?.focus();
  }

  function handleInput(e) {
    value = e.target.value;
    oninput?.(value);
  }
</script>

<div class="toolbar">
  <div class="search-container">
    <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
    </svg>
    <input
      bind:this={inputEl}
      type="text"
      class="search-input"
      {placeholder}
      {value}
      oninput={handleInput}
      autofocus={autofocus}
    >
    {#if value}
      <button class="clear-btn" onclick={handleClear} title="Clear search">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    flex-shrink: 0;
  }
  .search-container {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--divider-color);
  }
  .search-icon {
    width: 14px;
    height: 14px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    font-family: inherit;
  }
  .search-input::placeholder {
    color: var(--text-tertiary);
  }
  .clear-btn {
    display: flex;
    align-items: center;
    padding: 2px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary);
    border-radius: 6px;
    transition: color 0.15s ease;
  }
  .clear-btn:hover {
    color: var(--text-secondary);
  }
  .clear-btn svg {
    width: 14px;
    height: 14px;
  }
</style>
