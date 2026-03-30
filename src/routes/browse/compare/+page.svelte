<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconArrowLeft, IconArrowsShuffle } from "@tabler/icons-svelte";

  import Rating from "$lib/components/Rating.svelte";
  import Tags from "$lib/components/Tags.svelte";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { imgSrc } from "$lib/client/api.js";

  import { CompareShuffle } from "./compareShuffle.svelte.js";

  let { data }: { data: PageData } = $props();

  const handleBack = (e: MouseEvent) => {
    e.preventDefault();
    history.back();
  };

  const shuffle = new CompareShuffle();
</script>

<svelte:head>
  <title>Compare — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={shuffle.handleWindowKeydown} />

<header class="page-header">
  <button type="button" class="btn-ghost btn-sm" onclick={handleBack}>
    <IconArrowLeft size={16} />
    <span>上一頁</span>
  </button>

  <h1 class="page-header-title">比較圖片</h1>

  <small>共 {data.total} 張</small>
</header>

<main class="defer-dim slide-up" class:pending={shuffle.pending}>
  {#if data.pairs.length < 2}
    {#if !shuffle.pending}
      <p>篩選條件下的圖片不足兩張</p>
    {/if}
  {:else}
    {#each data.pairs as image (image.id)}
      <a class="card" href="/editor?currentId={encodeURIComponent(image.id)}" title="在管理圖片中開啟">
        <div class="card-image">
          {#key image.id}
            {@const blurhash = image.blurhash}
            {@const width = image.width}
            {@const height = image.height}
            {@const style = blurhashStyle({ fit: "contain", blurhash, width, height })}
            <img src={imgSrc(image.id)} {style} alt={image.name || image.id} draggable="false" />
          {/key}
        </div>

        <div class="card-info">
          <Rating readonly value={image.rating ?? 0} size="0.875rem" />
          <Tags tags={image.tags} />
        </div>
      </a>
    {/each}
  {/if}
</main>

<footer>
  <button
    type="button"
    class="btn-primary"
    class:pending={shuffle.pending}
    onclick={shuffle.handleShuffleClick}
    disabled={shuffle.pending}
  >
    <IconArrowsShuffle size={18} />
    <span>換一組</span><span class="kbd">Space</span>
  </button>
</footer>

<style>
  header > small {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-dim);
    white-space: nowrap;
    margin-left: auto;
  }

  /* --- */

  main {
    display: flex;
    gap: 1rem 0.5rem;
    padding: 1rem;
    flex: 1;
    min-height: 0;

    & > p {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      font-size: 0.875rem;
    }
  }

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

  /* --- */

  footer {
    display: grid;
    place-items: center;
    height: 3rem;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
  }
</style>
