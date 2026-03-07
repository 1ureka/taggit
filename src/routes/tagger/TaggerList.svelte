<script lang="ts">
  import { getTaggerContext } from "./context.svelte.js";
  import { createTaggerList } from "./taggerList.svelte.js";

  const ctx = getTaggerContext();
  const ui = createTaggerList();
</script>

<div class="tagger-sidebar-list" bind:this={ctx.listEl} onscroll={ui.handleListScroll}>
  {#if ctx.list.length === 0}
    <div class="tagger-empty">沒有待審查的圖片</div>
  {:else}
    <div class="virtual-scroll-content" style="height:{ui.totalH}px">
      {#each ui.visible as item (item.filename)}
        <button
          type="button"
          class="tagger-thumb"
          class:active={item.index === ctx.cursor}
          class:selected={ctx.selected.has(item.index)}
          style="top:{item.index * ctx.ITEM_H}px"
          onclick={(e) => ui.handleItemClick(e, item.index)}
        >
          <img
            class="tagger-thumb-img"
            src="/img/staged/{encodeURIComponent(item.filename)}"
            alt={item.filename}
            loading="lazy"
          />
          <span class="tagger-thumb-name">{item.filename}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tagger-sidebar-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .virtual-scroll-content {
    position: relative;
  }

  .tagger-thumb {
    position: absolute;
    left: 0;
    height: 72px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    border: none;
    border-left: 3px solid transparent;
    background: transparent;
    width: 100%;
    text-align: left;
    color: inherit;
    font-family: inherit;
    transition:
      background 0.1s,
      border-color 0.15s;
    user-select: none;
  }

  .tagger-thumb:hover {
    background: var(--bg-hover);
  }

  .tagger-thumb.selected {
    background: var(--bg-active);
    border-left-color: var(--text-dim);
  }

  .tagger-thumb.active {
    background: var(--bg-active);
    border-left-color: var(--accent);
  }

  .tagger-thumb-img {
    width: auto;
    height: 60px;
    max-width: 80px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .tagger-thumb-name {
    flex: 1;
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tagger-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }
</style>
