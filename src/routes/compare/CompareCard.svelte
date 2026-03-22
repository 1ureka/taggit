<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import Rating from "$lib/components/Rating.svelte";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { imgSrc } from "$lib/client/api.js";

  type Props = { image: ImageWithId };
  let { image }: Props = $props();
</script>

<a class="card" href="/editor/{encodeURIComponent(image.id)}" title="在 Editor 中開啟">
  <div class="card-image">
    {#key image.id}
      <img
        src={imgSrc(image.id)}
        style={blurhashStyle({ fit: "contain", blurhash: image.blurhash, width: image.width, height: image.height })}
        alt={image.name || image.id}
        draggable="false"
      />
    {/key}
  </div>
  <div class="card-info">
    <Rating readonly value={image.rating ?? 0} size="0.875rem" />
    <div class="tags">
      {#each image.tags as tag}
        <span class="chip">{tag}</span>
      {/each}
    </div>
  </div>
</a>

<style>
  .card {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 2);
    overflow: hidden;

    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    &:hover {
      border-color: var(--border-hover);
      box-shadow: 0 0 0 1px var(--border-hover);
    }
  }

  .card-image {
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

  .card-info {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--border);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
</style>
