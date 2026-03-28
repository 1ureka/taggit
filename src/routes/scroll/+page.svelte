<script lang="ts">
  import { fly } from "svelte/transition";
  import { navigating } from "$app/state";
  import { IconArrowUp, IconArrowLeft, IconPlayerPlayFilled, IconArrowsLeftRight } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import Select from "$lib/components/Select.svelte";
  import FilterFields from "$lib/components/FilterFields.svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";

  import { Masonry } from "$lib/virtualizer/masonry.svelte.js";
  import { ScrollFab } from "./scrollFab.svelte.js";
  import { ScrollForm } from "./scrollForm.svelte.js";

  const columnOptions = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 欄` }));

  const breakpoints = [
    { width: 1600, cols: 5 },
    { width: 1200, cols: 4 },
    { width: 900, cols: 3 },
    { width: 600, cols: 2 },
    { width: 0, cols: 1 },
  ];

  // ---

  let { data }: { data: PageData } = $props();

  const masonry = new Masonry({
    get items() {
      return data.items;
    },
    paddingX: 24,
    paddingY: 24,
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

  const form = new ScrollForm();
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

    <div>
      <Select bind:value={masonry.columns} options={columnOptions} />
    </div>
  </header>

  <main class="slide-up">
    <aside class="left-panel">
      <header>
        <div>
          <h2>搜尋與排序</h2>
          <p>共 {data.total} 張</p>
        </div>

        <div>
          <FilterFields
            bind:search={form.search}
            bind:includedTags={form.includedTags}
            bind:excludedTags={form.excludedTags}
            bind:rating={form.rating}
            bind:ratingOp={form.ratingOp}
            bind:sort={form.sort}
            bind:order={form.order}
            onchangeSearch={form.handleSearchChange}
            onchange={form.handleChange}
          />
        </div>
      </header>

      <footer>
        <a class="btn-primary" href={`/browse/player${form.queryString}`}>
          <IconPlayerPlayFilled size={16} />
          <span>播放</span>
        </a>
        <a class="btn-outlined" href={`/compare${form.queryString}`}>
          <IconArrowsLeftRight size={16} />
          <span>比較</span>
        </a>
      </footer>
    </aside>

    <div class="masonry-viewport" bind:this={masonry.viewportEl}>
      {#if data.total === 0 && !navigating.to}
        <p>找不到符合的圖片</p>
      {/if}

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

  header.page-header > h1 + div {
    margin-left: auto;
  }

  main {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }

  /* --- */

  aside.left-panel {
    position: relative;
    overflow-y: auto;
    width: 280px;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
  }

  aside.left-panel > header {
    display: flex;
    flex-direction: column;

    & > div:has(h2) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0px 0.75rem;
      height: 2.5rem;
      border-bottom: 1px solid var(--border);

      & > h2 {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-muted);
      }

      & > p {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        color: var(--text-dim);
      }
    }

    & > div:not(:has(h2)) {
      padding: 0.75rem;
    }
  }

  aside.left-panel > footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border);

    & > a {
      justify-content: space-between;
    }

    & > a > span {
      flex: 1;
      text-align: center;
    }
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

  .masonry-viewport > p {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 3rem 0px;
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
