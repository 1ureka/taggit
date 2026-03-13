<script lang="ts">
  import { ZoomPan } from "$lib/ui/zoom-pan.svelte.js";
  import { TaggerPreview } from "./taggerPreview.svelte.js";

  type Props = { currentFile: string | null; imageLoading: boolean };

  let { currentFile, imageLoading = $bindable() }: Props = $props();

  const zp = new ZoomPan();
  const ui = new TaggerPreview({
    get currentFile() {
      return currentFile;
    },
    get imageLoading() {
      return imageLoading;
    },
    set imageLoading(v) {
      imageLoading = v;
    },
    onChangeImage: () => zp.reset(),
  });
</script>

<svelte:window onmousemove={zp.handleWindowMousemove} onmouseup={zp.handleWindowMouseup} />

<section class="tagger-preview">
  {#if currentFile}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="tagger-preview-container"
      class:dragging={zp.isDragging}
      onwheel={zp.handleContainerWheel}
      onmousedown={zp.handleContainerMousedown}
      ondblclick={zp.handleContainerReset}
      role="img"
    >
      <img
        src={ui.previewSrc}
        alt={currentFile}
        draggable="false"
        class:loading={imageLoading}
        style="transform:{zp.transform}"
        onload={ui.handleImageLoad}
      />
    </div>
    <div class="tagger-preview-info">
      {currentFile}
    </div>
  {:else}
    <div class="tagger-preview-container">
      <div class="tagger-empty">未選取任何圖片</div>
    </div>
    <div class="tagger-preview-info">--</div>
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

  .tagger-preview-container:has(.tagger-empty) {
    cursor: auto;
    user-select: auto;
  }

  .tagger-preview-container img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transform-origin: center center;
    transition: opacity 0.2s;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }

  .tagger-preview-container img.loading {
    opacity: 0.75;
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
