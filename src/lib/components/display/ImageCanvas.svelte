<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { ImageCanvas } from "./image-canvas.core.svelte";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** 容器內容，通常是圖片，但可以是任意內容 */
    children: Snippet;
    /** 內容身分鍵，變化時重置縮放/平移（例如切換圖片時傳入新的 src） */
    resetKey?: unknown;
    /** 最小縮放比例，預設 0.2 */
    minScale?: number;
    /** 最大縮放比例，預設 10 */
    maxScale?: number;
  }

  let { children, resetKey, minScale = 0.2, maxScale = 10, ...rest }: Props = $props();

  const ui = new ImageCanvas({
    get resetKey() {
      return resetKey;
    },
    get minScale() {
      return minScale;
    },
    get maxScale() {
      return maxScale;
    },
  });
</script>

<svelte:window onmousemove={ui.handleWindowMousemove} onmouseup={ui.handleWindowMouseup} />

<div
  bind:this={ui.containerEl}
  use:ui.measureContainer
  class={{ viewport: true, dragging: ui.isDragging }}
  role="button"
  tabindex="0"
  aria-label="圖片預覽區域：滾輪或 +/− 縮放（以指標位置為錨點）、拖曳或方向鍵平移、雙擊／Enter／Space／Esc 重置"
  onwheel={ui.handleContainerWheel}
  onmousedown={ui.handleContainerMousedown}
  ondblclick={ui.handleContainerDblclick}
  onkeydown={ui.handleContainerKeydown}
  {...rest}
>
  <div bind:this={ui.contentEl} use:ui.measureContent class="content" style:transform={ui.transform}>
    {@render children()}
  </div>
</div>

<style>
  .viewport {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: grab;
    user-select: none;

    &.dragging {
      cursor: grabbing;
    }
  }

  .content {
    transform-origin: center center;
    will-change: transform;
  }
</style>
