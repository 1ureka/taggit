<script lang="ts">
  import { ZoomPan } from "$lib/ui/zoom-pan.svelte.js";
  import { TaggerPreview } from "./taggerPreview.svelte.js";

  type Props = { currentFile: string | null };

  let { currentFile }: Props = $props();

  const zp = new ZoomPan();
  const ui = new TaggerPreview({
    get currentFile() {
      return currentFile;
    },
    onChangeImage: zp.handleContainerReset,
  });
</script>

<svelte:window onmousemove={zp.handleWindowMousemove} onmouseup={zp.handleWindowMouseup} />

<section>
  {#if currentFile}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="container"
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
        class:loading={ui.imageLoading}
        style="transform:{zp.transform}"
        onload={ui.handleImageLoad}
      />
    </div>
    <div class="info">
      {currentFile}
    </div>
  {:else}
    <div class="container">
      <div class="empty">未選取任何圖片</div>
    </div>
    <div class="info">--</div>
  {/if}
</section>

<style>
  section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    min-width: 0;
  }

  .container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: grab;
    position: relative;
    user-select: none;
    -webkit-user-select: none;

    &.dragging {
      cursor: grabbing;
    }

    &:has(.empty) {
      cursor: auto;
      user-select: auto;
    }

    & img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transform-origin: center center;
      transition: opacity 0.2s;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;

      &.loading {
        opacity: 0.75;
      }
    }
  }

  .info {
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

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }
</style>
