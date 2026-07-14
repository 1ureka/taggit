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

  // src 變更時重置為載入中；利用 derived 可暫時寫入的特性，由 onload 收尾
  let loading = $derived.by(() => {
    src;
    return true;
  });

  const handleLoad = () => (loading = false);
</script>

{#if preview}
  <!-- 帶 preview 時透過 key 強制重新 mount，讓 BlurHash 佔位能被看見 -->
  {#key src}
    <img
      {src}
      {alt}
      style={`object-fit:${fit};${blurhashStyle({ ...preview, fit })};${style ?? ""}`}
      onload={handleLoad}
      {...rest}
    />
  {/key}
{:else}
  <!-- 無 preview 時保持上一張圖片，載入超過 0.2s 才調暗，避免快速切換時閃爍 -->
  <img
    class={{ loading }}
    {src}
    {alt}
    style={`object-fit:${fit};${style ?? ""}`}
    onload={handleLoad}
    {...rest}
  />
{/if}

<style>
  img {
    opacity: 1;
    transition: opacity 0s step-start;
  }

  img.loading {
    opacity: 0.4;
    transition: opacity 0.2s step-end;
  }
</style>
