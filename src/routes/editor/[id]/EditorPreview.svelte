<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { createEditorPreview } from "./editorPreview.svelte.js";

  type Props = {
    image: ImageWithId;
    loading: boolean;
  };

  let { image, loading }: Props = $props();

  const ui = createEditorPreview({
    get image() {
      return image;
    },
    get loading() {
      return loading;
    },
  });
</script>

<svelte:window onmousemove={ui.handleWindowMousemove} onmouseup={ui.handleWindowMouseup} />

<section class="editor-preview">
  {#if ui.previewFilename}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="editor-preview-container"
      class:dragging={ui.isDragging}
      onwheel={ui.handleContainerWheel}
      onmousedown={ui.handleContainerMousedown}
      ondblclick={ui.handleContainerDblclick}
      role="img"
    >
      <img
        src={ui.previewSrc}
        alt={ui.previewFilename}
        draggable="false"
        class:loading={ui.loading}
        style="transform:{ui.transform}"
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
    transition: opacity 0.2s;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }

  .editor-preview-container img.loading {
    opacity: 0.75;
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
