<script lang="ts">
  import type { PageData } from "./$types.js";
  import { page } from "$app/state";
  import { IconArrowsShuffle } from "$lib/components/icons";

  import Rating from "$lib/components/form/Rating.svelte";
  import Tags from "$lib/components/misc/Tags.svelte";
  import { imgSrc, blurhashStyle } from "$lib/image/client.js";
  import { CompareShuffle } from "./compareShuffle.svelte.js";

  let { data }: { data: PageData } = $props();

  const shuffle = new CompareShuffle();

  /** 前往 editor 的連結，帶上當下的篩選參數，避免隱藏標籤圖片在 editor 被再次遮蔽 */
  const editorHref = (id: string) => {
    const params = new URLSearchParams(page.url.searchParams);
    params.set("currentId", id);
    return `/editor?${params.toString()}`;
  };
</script>

<svelte:head>
  <title>比較圖片 — Taggit</title>
</svelte:head>

<svelte:window onkeydown={shuffle.handleWindowKeydown} />

<main class="defer-dim slide-up" class:pending={shuffle.pending}>
  {#if data.pairs.length < 2}
    {#if !shuffle.pending}
      <p>篩選條件下的圖片不足兩張</p>
    {/if}
  {:else}
    {#each data.pairs as image (image.id)}
      <a class="card" href={editorHref(image.id)} title="在管理圖片中開啟">
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
          <Rating readonly value={image.rating ?? 0} size="1rem" />
          <Tags tags={image.tags} nowrap />
        </div>
      </a>
    {/each}
  {/if}
</main>

<footer>
  <span></span>

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

  <small>共 {data.total} 張</small>
</footer>

<style>
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
      font-size: var(--font-size-body1);
    }
  }

  .card {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: var(--border-style);
    border-radius: calc(var(--radius) * 2);
    overflow: hidden;
    transition: border-color 0.15s;

    &:hover {
      border-color: var(--border-hover);
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
    border-top: var(--border-style);
  }

  /* --- */

  footer {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    place-items: center;
    height: 3rem;
    background: var(--bg-card);
    border-top: var(--border-style);

    & > small {
      font-size: var(--font-size-caption);
      font-family: var(--font-mono);
      color: var(--text-dim);
      white-space: nowrap;
      margin-left: auto;
      padding-right: 1.5rem;
    }
  }
</style>
