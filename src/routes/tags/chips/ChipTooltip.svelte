<script lang="ts">
  import type { ImageWithId, Tag } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import { IconEyeOff } from "$lib/icons";
  import { getPreviewsContext } from "../logic/previews.svelte";

  let { previews, tag }: { previews: ReturnType<typeof getPreviewsContext>; tag: Tag } = $props();

  let hoverTimer: ReturnType<typeof setTimeout>;
  const cache = $derived(previews.get(tag.name));

  $effect(() => {
    if (tag.count === 0) return;
    hoverTimer = setTimeout(() => previews.request(tag.name), 300);
    return () => clearTimeout(hoverTimer);
  });
</script>

{#snippet metaDisplay()}
  <div class="tip-meta">
    <span class="tip-name ellipsis">{tag.name}</span>
    <span class="tip-count">×{tag.count}</span>
    {#if tag.meta.hidden}
      <span class="tip-hidden"><IconEyeOff size={12} />隱藏</span>
    {/if}
  </div>
{/snippet}

{#snippet loadingDisplay()}
  <div class="thumbs">
    {#each { length: Math.min(tag.count, 4) }, i (i)}
      <div class="thumb skeleton"></div>
    {/each}
  </div>
{/snippet}

{#snippet thumbnailDisplay(images: ImageWithId[])}
  <div class="thumbs">
    {#each images as img (img.id)}
      <img class="thumb" src={imgSrc(img.id, "sm")} alt={img.name} decoding="async" />
    {/each}
  </div>
{/snippet}

<div class="tip">
  {@render metaDisplay()}

  {#if tag.count === 0}
    <span class="tip-empty">沒有已提交的圖片使用此標籤</span>
  {:else if cache === undefined || cache === "loading"}
    {@render loadingDisplay()}
  {:else}
    {@render thumbnailDisplay(cache)}
  {/if}
</div>

<style>
  .tip {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-width: 16rem;
    padding: 0.125rem;
  }

  .tip-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  .tip-name {
    min-width: 0;
    font: var(--font-body2);
    font-weight: 600;
  }

  .tip-count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    opacity: 0.7;
  }

  .tip-hidden {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    font: var(--font-caption);
    font-weight: normal;
    opacity: 0.7;
  }

  .tip-empty {
    font: var(--font-caption);
    font-weight: normal;
    opacity: 0.7;
  }

  .thumbs {
    display: flex;
    gap: 0.25rem;
  }

  .thumb {
    --color-skeleton: color-mix(in srgb, var(--color-bg) 80%, var(--color-text));
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: calc(var(--border-radius) / 1.5);
  }
</style>
