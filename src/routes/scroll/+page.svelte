<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";

  import { Masonry } from "$lib/virtualizer/masonry.svelte.js";
  import Select from "$lib/components/Select.svelte";

  import ScrollFab from "./ScrollFab.svelte";
  import ScrollForm from "./ScrollForm.svelte";

  let { data }: { data: PageData } = $props();

  let pageContentEl = $state<HTMLElement | null>(null);

  const columnOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
    value: n,
    label: `${n} 欄`,
  }));

  const masonry = new Masonry({
    get initialItems() {
      return data.items;
    },
    paddingX: 24,
    paddingY: 12,
    gap: 6,
  });

  $effect(() => {
    const breakpoints = [
      { width: 1600, cols: 6 },
      { width: 1200, cols: 5 },
      { width: 900, cols: 4 },
      { width: 600, cols: 2 },
      { width: 0, cols: 1 },
    ];

    const width = window.innerWidth;
    masonry.columns = breakpoints.find((b) => width >= b.width)?.cols ?? 3;
  });
</script>

<svelte:head>
  <title>Scroll — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      <span>首頁</span>
    </a>

    <h1 class="page-header-title">瀏覽圖片</h1>

    <div class="controls">
      <Select bind:value={masonry.columns} options={columnOptions} />
    </div>
  </header>

  <main class="slide-up" bind:this={pageContentEl}>
    <ScrollForm total={data.total} />

    {#if data.total === 0}
      <div class="empty">找不到符合的圖片</div>
    {/if}

    <div class="masonry-viewport" bind:this={masonry.viewportEl}>
      <div class="masonry" style:height="{masonry.masonryHeight}px">
        {#each masonry.masonryItems as item (item.id)}
          <div class="masonry-item" style={item.style}>
            <img
              src={imgSrc(item.id, "md")}
              style={blurhashStyle({ fit: "cover", blurhash: item.blurhash, width: item.width, height: item.height })}
              alt={item.name || item.id}
              loading="lazy"
            />
          </div>
        {/each}
      </div>
    </div>
  </main>
</div>

<ScrollFab {pageContentEl} />

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    align-items: stretch;
    overflow: hidden;
  }

  /* --- */

  main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* --- */

  .controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* --- */

  .masonry-viewport {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .masonry {
    position: relative;
  }

  .masonry-item > img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    border-radius: 4px;
  }

  .empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 3rem 1rem;
  }
</style>
