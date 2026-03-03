<script lang="ts">
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

  // ── Local zoom / pan state ────────────────────────────────
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;

  function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
  }

  // React to navigation: reset zoom
  $effect(() => {
    const tick = uiStore.navigationTick;
    if (tick === 0) return;
    resetZoom();
  });

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale = Math.max(0.2, Math.min(10, scale + delta * scale));
  }

  function handleMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
  }

  function handleWindowMousemove(e: MouseEvent) {
    if (!isDragging) return;
    panX = dragStartPanX + (e.clientX - dragStartX);
    panY = dragStartPanY + (e.clientY - dragStartY);
  }

  function handleWindowMouseup() {
    isDragging = false;
  }
</script>

<svelte:window onmousemove={handleWindowMousemove} onmouseup={handleWindowMouseup} />

<section class="tagger-preview">
  {#if currentFile}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tagger-preview-container"
      class:dragging={isDragging}
      onwheel={handleWheel}
      onmousedown={handleMousedown}
      ondblclick={resetZoom}
      role="img"
    >
      <img
        src={previewSrc}
        alt={currentFile}
        draggable="false"
        style="transform:translate({panX}px,{panY}px) scale({scale})"
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
