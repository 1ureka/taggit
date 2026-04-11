<script lang="ts">
  import { blurhashStyle } from "$lib/client/blurhash";
  import { ZoomPan } from "$lib/ui/zoom-pan.svelte";

  type PreviewConfig = {
    /** 當前圖片的模糊哈希 */
    blurhash: string;
    /** 當前圖片的寬度 */
    width: number;
    /** 當前圖片的高度 */
    height: number;
  };

  type Props = {
    /** 圖片資訊，若沒有提供視作目前無圖片 */
    image?: {
      /** 當前圖片的來源 */
      src: string;
      /** 當前圖片的替代文字 */
      alt: string;
      /** 當前圖片的預覽資訊，當提供時，會在載入與解碼時顯示模糊預覽 */
      preview?: PreviewConfig;
    };
    /** 當前顯示區域為空時的提示文字 */
    emptyLabel: string;
  };

  let { image, emptyLabel }: Props = $props();

  const zp = new ZoomPan();

  const resetCh = $derived(image ? image.src : "empty"); // make(chan string)
  $effect(() => {
    // image?.src; 在呼叫方不夠謹慎時，可能會導致 image 引用變更但 src 不變的情況也被觸發
    resetCh; // _ := <- resetCh
    zp.handleContainerReset();
  });

  let loading = $derived.by(() => {
    // 同上，這裡同時利用 Svelte 5.25+ 之後的官方推薦， derived 可暫時寫入的特性省去 $effect
    resetCh; // _ := <- resetCh
    return true;
  });

  const handleImageLoad = () => (loading = false);
</script>

<svelte:window onmousemove={zp.handleWindowMousemove} onmouseup={zp.handleWindowMouseup} />

{#if image}
  <!-- 當新的圖片帶有 preview 時，透過 key 強制重新 mount，讓 blurhash 能被看見 -->
  {#snippet imageWithPreview(preview: PreviewConfig)}
    {#key image.src}
      {@const { src, alt } = image}
      {@const style = blurhashStyle({ ...preview, fit: "contain" })}
      <img {src} {alt} draggable="false" style={`transform:${zp.transform};${style}`} onload={handleImageLoad} />
    {/key}
  {/snippet}

  <!-- 當新的圖片沒有 preview 時，保持上一張圖片的狀態，並透過 loading class 當載入超過 0.2s 時顯示載入效果 -->
  {#snippet imageWithoutPreview()}
    {@const { src, alt } = image}
    {@const style = `transform:${zp.transform}`}
    <img class={{ loading }} {src} {alt} {style} draggable="false" onload={handleImageLoad} />
  {/snippet}

  <div
    class="viewport"
    class:dragging={zp.isDragging}
    onwheel={zp.handleContainerWheel}
    onmousedown={zp.handleContainerMousedown}
    ondblclick={zp.handleContainerReset}
    onkeydown={zp.handleContainerKeydown}
    tabindex="0"
    role="button"
    aria-label="圖片預覽區域：支援縮放 (Z/+/Scroll)、平移 (Arrows/Drag) 及重置 (Enter/Esc/Space)"
  >
    {#if image.preview}
      {@render imageWithPreview(image.preview)}
    {:else}
      {@render imageWithoutPreview()}
    {/if}
  </div>
{:else}
  <div class="viewport">
    <span>{emptyLabel}</span>
  </div>
{/if}

<style>
  .viewport {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;

    & > img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transform-origin: center center;
    }

    & > span {
      font-size: var(--font-size-body1);
      color: var(--text-dim);
    }
  }

  .viewport {
    opacity: 1;
    transition: opacity 0s step-start;

    &:has(.loading) {
      opacity: 0.4;
      transition: opacity 0.2s step-end;
    }
  }

  .viewport {
    & > img {
      transition: transform 0.1s ease-out;
    }

    &.dragging > img {
      transition: none;
    }
  }

  .viewport {
    cursor: grab;
    user-select: none;

    &.dragging {
      cursor: grabbing;
    }

    &:has(span) {
      cursor: auto;
      user-select: auto;
    }
  }
</style>
