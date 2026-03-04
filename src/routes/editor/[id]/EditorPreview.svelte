<script lang="ts">
  let {
    currentFilename,
    previewSrc,
  }: {
    currentFilename: string | null;
    previewSrc: string;
  } = $props();

  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;

  /** Reset zoom whenever the image source changes. */
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    previewSrc;
    scale = 1;
    panX = 0;
    panY = 0;
  });

  function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
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

<section class="editor-preview">
  {#if currentFilename}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="editor-preview-container"
      class:dragging={isDragging}
      onwheel={handleWheel}
      onmousedown={handleMousedown}
      ondblclick={resetZoom}
      role="img"
    >
      <img
        src={previewSrc}
        alt={currentFilename}
        draggable="false"
        style="transform:translate({panX}px,{panY}px) scale({scale})"
      />
    </div>
  {:else}
    <div class="editor-preview-container">
      <div class="editor-empty">找不到圖片</div>
    </div>
  {/if}
</section>

<style>
  .editor-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    min-width: 0;
  }

  .editor-preview-container {
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

  .editor-preview-container.dragging {
    cursor: grabbing;
  }

  .editor-preview-container img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transform-origin: center center;
    transition: none;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }

  .editor-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }
</style>
