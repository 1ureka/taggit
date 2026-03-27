<script lang="ts">
  import { fly } from "svelte/transition";
  import { navigating } from "$app/state";
  import { IconArrowUp, IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import Select from "$lib/components/Select.svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";

  import { Masonry } from "$lib/virtualizer/masonry.svelte.js";
  import { ScrollFab } from "./scrollFab.svelte.js";
  import ScrollForm from "./ScrollForm.svelte";

  const columnOptions = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 欄` }));

  const breakpoints = [
    { width: 1600, cols: 6 },
    { width: 1200, cols: 5 },
    { width: 900, cols: 4 },
    { width: 600, cols: 2 },
    { width: 0, cols: 1 },
  ];

  // ---

  let { data }: { data: PageData } = $props();

  const masonry = new Masonry({
    get initialItems() {
      return data.items;
    },
    paddingX: 24,
    paddingY: 12,
    gap: 6,
  });

  $effect(() => {
    masonry.columns = breakpoints.find((b) => window.innerWidth >= b.width)?.cols ?? 3;
  });

  const fab = new ScrollFab({
    get viewportEl() {
      return masonry.viewportEl;
    },
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

  <main class="slide-up">
    <ScrollForm total={data.total} />

    {#if data.total === 0 && !navigating.to}
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

{#if fab.show}
  <button
    class="fab bottom-right"
    onclick={fab.handleFabClick}
    aria-label="回到頂部"
    transition:fly={{ y: 16, duration: 200, opacity: 0 }}
  >
    <IconArrowUp size={20} />
  </button>
{/if}

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

  /* --- */

  .fab {
    position: fixed;
    width: 48px;
    height: 48px;
    border-radius: 50%;

    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--bg);

    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s;

    &.bottom-right {
      bottom: 1.5rem;
      right: 1.5rem;
    }

    &:hover {
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }
</style>
