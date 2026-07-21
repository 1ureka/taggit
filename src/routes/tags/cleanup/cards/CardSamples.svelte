<script lang="ts">
  import type { Suggestion } from "../logic/suggestions";
  import { imgSrc, blurhashStyle } from "$lib/image/client";
  import { getSamplesContext } from "../logic/samples.svelte";

  let { suggestion }: { suggestion: Suggestion } = $props();

  const samples = getSamplesContext();
  const cache = $derived(samples.get(suggestion.id));

  // 卡片因虛擬化捲動快速略過時，延遲一拍再查，避免瞬間掃過的卡片也發出請求
  $effect(() => {
    const timer = setTimeout(() => samples.request(suggestion), 150);
    return () => clearTimeout(timer);
  });
</script>

{#if cache === undefined || cache === "loading"}
  <div class="thumbs">
    {#each { length: 3 }, i (i)}
      <div class="thumb placeholder"></div>
    {/each}
  </div>
{:else if cache.length > 0}
  <div class="thumbs">
    {#each cache as img (img.id)}
      <img src={imgSrc(img.id, "sm")} alt={img.name} loading="lazy" style={blurhashStyle(img)} />
    {/each}
  </div>
{/if}

<style>
  .thumbs {
    display: flex;
    flex-shrink: 0;
    gap: 0.375rem;
  }

  .thumb,
  img {
    width: 2.25rem;
    height: 2.25rem;
    flex-shrink: 0;
    object-fit: cover;
    background: var(--color-bg);
    border-radius: calc(var(--border-radius) / 1.5);
  }

  .thumb.placeholder {
    background: hsl(from currentColor h s l / 0.15);
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.9;
    }
  }
</style>
