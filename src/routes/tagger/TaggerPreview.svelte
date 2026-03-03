<script lang="ts">
  let { currentFilename, previewSrc }: { currentFilename: string | null; previewSrc: string } = $props();

  // ─── Internal zoom / pan state ──────────────────────────────────────
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;
  let previewImg: HTMLImageElement | undefined = $state();

  /** Reset zoom and pan to default. */
  export function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
  }

  /** Get the natural dimensions of the loaded image. */
  export function getImageDimensions(): { width: number; height: number } {
    return {
      width: previewImg?.naturalWidth || 0,
      height: previewImg?.naturalHeight || 0,
    };
  }

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
  {#if currentFilename}
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
        bind:this={previewImg}
        src={previewSrc}
        alt={currentFilename}
        draggable="false"
        style="transform:translate({panX}px,{panY}px) scale({scale})"
      />
    </div>
    <div class="tagger-preview-info">{currentFilename}</div>
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

  .tagger-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }
</style>
