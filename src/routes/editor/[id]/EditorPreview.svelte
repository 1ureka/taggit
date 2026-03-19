<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { imgSrc } from "$lib/client/api.js";
  import { ZoomPan } from "$lib/ui/zoom-pan.svelte.js";

  type Props = { image: ImageWithId; loading: boolean };

  let { image, loading }: Props = $props();

  const zp = new ZoomPan();
  const previewFilename = $derived(image.id + image.ext);
  const previewSrc = $derived(imgSrc("committed", previewFilename));
</script>

<svelte:window onmousemove={zp.handleWindowMousemove} onmouseup={zp.handleWindowMouseup} />

<section>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="container"
    class:dragging={zp.isDragging}
    onwheel={zp.handleContainerWheel}
    onmousedown={zp.handleContainerMousedown}
    ondblclick={zp.handleContainerReset}
    role="img"
  >
    <img src={previewSrc} alt={previewFilename} draggable="false" class:loading style="transform:{zp.transform}" />
  </div>
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

    &.dragging {
      cursor: grabbing;
    }

    & > img {
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
</style>
