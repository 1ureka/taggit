<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import Rating from "$lib/components/Rating.svelte";
  import { blurhashStyle } from "$lib/client/blurhash";

  type Props = { image: ImageWithId; onclick: () => void };
  let { image, onclick }: Props = $props();
</script>

<button class="compare-card" type="button" {onclick} title="在 Editor 中開啟">
  <div class="compare-card-image">
    {#key image.id}
      <img
        src="/img/committed/{image.id}{image.ext}"
        style={blurhashStyle({ fit: "contain", blurhash: image.blurhash, width: image.width, height: image.height })}
        alt={image.name || image.id}
        draggable="false"
      />
    {/key}
  </div>
  <div class="compare-card-info">
    <Rating readonly value={image.rating ?? 0} size="0.875rem" />
    <div class="compare-card-info-tags">
      {#each image.tags as tag}
        <span class="chip">{tag}</span>
      {/each}
    </div>
  </div>
</button>

<style>
  .compare-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 2);
    overflow: hidden;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    &:hover {
      border-color: var(--border-hover);
      box-shadow: 0 0 0 1px var(--border-hover);
    }
  }

  .compare-card-image {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 0;
    background: var(--bg);

    & img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }

  .compare-card-info {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--border);
  }

  .compare-card-info-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
</style>
