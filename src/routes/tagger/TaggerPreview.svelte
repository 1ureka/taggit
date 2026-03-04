<script lang="ts">
  import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
  import { fileStore, selectionStore, uiStore } from "./stores.svelte.js";
  import { stagedUrl } from "./helpers.js";

  // ── Derived from stores ───────────────────────────────────
  let currentFile = $derived(
    selectionStore.cursor >= 0 && selectionStore.cursor < fileStore.list.length
      ? fileStore.list[selectionStore.cursor]
      : null,
  );
  let previewSrc = $derived(currentFile ? stagedUrl(currentFile) : "");
  let selectedCount = $derived(selectionStore.selected.size);

  // ── Zoom / pan ────────────────────────────────────────────
  const zp = useZoomPan();

  // React to navigation: reset zoom
  $effect(() => {
    const tick = uiStore.navigationTick;
    if (tick === 0) return;
    zp.reset();
  });
</script>

<svelte:window onmousemove={zp.onWindowMousemove} onmouseup={zp.onWindowMouseup} />

<section class="tagger-preview">
  {#if currentFile}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tagger-preview-container"
      class:dragging={zp.isDragging}
      onwheel={zp.onWheel}
      onmousedown={zp.onMousedown}
      ondblclick={zp.reset}
      role="img"
    >
      <img
        src={previewSrc}
        alt={currentFile}
        draggable="false"
        style="transform:{zp.transform}"
      />
    </div>
    <div class="tagger-preview-info">
      {currentFile}
      {#if selectedCount > 1}
        <span class="selection-hint">已選 {selectedCount} 張</span>
      {/if}
    </div>
  {:else}
    <div class="tagger-preview-container">
      <div class="tagger-empty">所有圖片皆已處理，沒有新圖片</div>
    </div>
    <div class="tagger-preview-info">所有圖片皆已處理，沒有新圖片</div>
  {/if}
</section>

<style>
  .tagger-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    min-width: 0;
  }

  .tagger-preview-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: grab;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  }

  .tagger-preview-container.dragging {
    cursor: grabbing;
  }

  .tagger-preview-container img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transform-origin: center center;
    transition: none;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }

  .tagger-preview-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.6875rem;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    background: var(--bg-card);
    min-height: 1.75rem;
  }

  .selection-hint {
    padding: 0.0625rem 0.375rem;
    border-radius: 9999px;
    background: var(--bg-active);
    color: var(--text-muted);
    font-size: 0.625rem;
    font-weight: 500;
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
