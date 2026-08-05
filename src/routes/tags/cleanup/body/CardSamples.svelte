<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Image from "$lib/components/display/Image.svelte";

  import { getSamplesContext } from "../logic/samples.svelte";
  import type { Suggestion } from "../logic/page-data.svelte";

  let { suggestion }: { suggestion: Suggestion } = $props();

  const samples = getSamplesContext();
  const cache = $derived(samples.get(suggestion.id));

  $effect(() => {
    if (cache !== undefined) return;
    const timer = setTimeout(() => samples.request(suggestion), 300);
    return () => clearTimeout(timer);
  });
</script>

<div class="container">
  {#if cache === undefined || cache === "loading"}
    {#each { length: 3 }, i (i)}
      <div class="image skeleton"></div>
    {/each}
  {:else if cache.length > 0}
    {#each cache as img (img.id)}
      {#snippet preview()}
        <div class="image-md">
          <Image src={imgSrc(img.id, "md")} alt={img.name} preview={img} fit="contain" />
        </div>
      {/snippet}

      <div class="image" {@attach tooltip({ content: preview })}>
        <Image src={imgSrc(img.id, "sm")} alt={img.name} preview={img} fit="cover" />
      </div>
    {/each}
  {/if}
</div>

<style>
  div.container {
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

  div.container > div.image {
    aspect-ratio: 1/1;
    flex-shrink: 0;
    border-radius: calc(var(--border-radius) / 1.5);
    overflow: hidden;
  }

  div.image-md {
    width: 15rem;
    height: 20rem;
    border-radius: calc(var(--border-radius) / 1.5);
    overflow: hidden;
    margin: 0.25rem 0.1rem;
  }
</style>
