<script lang="ts">
  import { imgSrc, blurhashStyle } from "$lib/image/client";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { getSamplesContext } from "../logic/samples.svelte";
  import type { Suggestion } from "../logic/suggestions";

  let { suggestion }: { suggestion: Suggestion } = $props();

  const samples = getSamplesContext();
  const cache = $derived(samples.get(suggestion.id));

  // 依賴快取狀態本身（而非 suggestion 參照）：快取被清空（例如重新整理、送出成功後）
  // 時 cache 會變回 undefined，這裡就會自動再排一次查詢，不必依賴 suggestion 物件參照
  // 剛好改變這種間接訊號，也不會在已有快取或正在載入時重複觸發。
  // 卡片因虛擬化捲動快速略過時，延遲一拍再查，避免瞬間掃過的卡片也發出請求。
  $effect(() => {
    if (cache !== undefined) return;
    const timer = setTimeout(() => samples.request(suggestion), 150);
    return () => clearTimeout(timer);
  });
</script>

<div class="thumbs">
  {#if cache === undefined || cache === "loading"}
    {#each { length: 3 }, i (i)}
      <div class="thumb skeleton"></div>
    {/each}
  {:else if cache.length > 0}
    {#each cache as img (img.id)}
      {#snippet preview()}
        <img class="preview" src={imgSrc(img.id, "md")} alt={img.name} loading="lazy" style={blurhashStyle(img)} />
      {/snippet}

      <img
        class="thumb"
        src={imgSrc(img.id, "sm")}
        alt={img.name}
        loading="lazy"
        style={blurhashStyle(img)}
        {@attach tooltip({ content: preview })}
      />
    {/each}
  {/if}
</div>

<style>
  .thumbs {
    position: relative;
    display: flex;
    flex: 1;
    gap: 0.375rem;
    margin: 0 0.75rem;
    margin-bottom: 0.375rem;
    padding-bottom: 0.25rem;
    min-height: 0px;
    border-radius: calc(var(--border-radius) / 1.5);
    overflow: hidden;
  }

  .thumbs > .thumb {
    aspect-ratio: 1/1;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: calc(var(--border-radius) / 1.5);
  }

  .preview {
    width: 15rem;
    height: 15rem;
    object-fit: cover;
    border-radius: calc(var(--border-radius) / 1.5);
    margin: 0.25rem 0.1rem;
  }
</style>
