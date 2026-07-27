<script lang="ts">
  import type { HTMLImgAttributes } from "svelte/elements";
  import { blurhashStyle } from "$lib/image/client";

  type Preview = {
    /** 圖片的 BlurHash */
    blurhash: string;
    /** 圖片的原始寬度 */
    width: number;
    /** 圖片的原始高度 */
    height: number;
  };

  type Props = HTMLImgAttributes & {
    /** 圖片來源 */
    src: string;
    /** 圖片替代文字 */
    alt: string;
    /** object-fit，同時決定 BlurHash 佔位的鋪法（預設 cover） */
    fit?: "cover" | "contain";
    /** 提供時，載入與解碼期間以 BlurHash 佔位；未提供時改以保留前一張 + 延遲調暗表達載入中 */
    preview?: Preview;
  };

  let { src, alt, fit = "cover", preview, style, ...rest }: Props = $props();

  /** 在組件的生命週期中，是否為首次載入 */
  let empty = $state(true);
  /** src 變更時重置為載入中，利用 derived 可暫時寫入的特性，由 onload 收尾 */
  let loading = $derived.by(() => {
    src;
    return true;
  });

  /** 圖片載入事件 */
  const handleLoad = () => {
    loading = false;
    empty = false;
  };
</script>

{#if preview}
  {#key src}
    {@const composed = `object-fit:${fit};${style ?? ""}`}
    {@const result = loading ? `${blurhashStyle({ ...preview, fit })};${composed}` : composed}
    <img {src} {alt} style={result} onload={handleLoad} {...rest} />
  {/key}
{:else}
  {@const composed = `object-fit:${fit};${style ?? ""}`}
  {@const classname = loading && empty ? { skeleton: true } : { loading }}
  <img class={classname} {src} {alt} style={composed} onload={handleLoad} {...rest} />
{/if}

<style>
  img {
    display: block;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    opacity: 1;
    transition: opacity 0s;
  }

  img.loading {
    opacity: 0.4;
    transition: opacity 0s 0.15s;
  }
</style>
