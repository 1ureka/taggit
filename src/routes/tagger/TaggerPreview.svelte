<script lang="ts">
  import { createTaggerPreview } from "./taggerPreview.svelte.js";

  const ui = createTaggerPreview();
</script>

<svelte:window onmousemove={ui.handleWindowMousemove} onmouseup={ui.handleWindowMouseup} />

<section class="tagger-preview">
  {#if ui.currentFile}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tagger-preview-container"
      class:dragging={ui.isDragging}
      onwheel={ui.handleContainerWheel}
      onmousedown={ui.handleContainerMousedown}
      ondblclick={ui.handleContainerDblclick}
      role="img"
    >
      <img
        src={ui.previewSrc}
        alt={ui.currentFile}
        draggable="false"
        class:loading={ui.loading || ui.imageLoading}
        style="transform:{ui.transform}"
        onload={ui.handleImageLoad}
      />
    </div>
    <div class="tagger-preview-info">
      {ui.currentFile}
      {#if ui.selectedCount > 1}
        <span class="selection-hint">已選 {ui.selectedCount} 張</span>
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
