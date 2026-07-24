<script lang="ts">
  import { imgSrc, blurhashStyle } from "$lib/image/client";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { getSamplesContext } from "../logic/samples.svelte";
  import type { Suggestion } from "../logic/suggestions";

  let { suggestion }: { suggestion: Suggestion } = $props();

  const samples = getSamplesContext();
  const cache = $derived(samples.get(suggestion.id));

  $effect(() => {
    if (cache !== undefined) return;
    const timer = setTimeout(() => samples.request(suggestion), 300);
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
