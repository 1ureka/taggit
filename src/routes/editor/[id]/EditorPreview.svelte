<script lang="ts">
  import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

  let {
    currentFilename,
    previewSrc,
  }: {
    currentFilename: string | null;
    previewSrc: string;
  } = $props();

  const zp = useZoomPan();

  /** Reset zoom whenever the image source changes. */
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    previewSrc;
    zp.reset();
  });
</script>

<svelte:window onmousemove={zp.onWindowMousemove} onmouseup={zp.onWindowMouseup} />

<section class="editor-preview">
  {#if currentFilename}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="editor-preview-container"
      class:dragging={zp.isDragging}
      onwheel={zp.onWheel}
      onmousedown={zp.onMousedown}
      ondblclick={zp.reset}
      role="img"
    >
      <img src={previewSrc} alt={currentFilename} draggable="false" style="transform:{zp.transform}" />
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
