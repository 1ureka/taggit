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
  import { BrowseFab } from "./browseFab.svelte.js";
  import { BrowseForm } from "./browseForm.svelte.js";

  const columnOptions = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 欄` }));

  const breakpoints = [
    { width: 1600, cols: 5 },
    { width: 1200, cols: 4 },
    { width: 900, cols: 3 },
    { width: 600, cols: 2 },
    { width: 0, cols: 2 },
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

  const fab = new BrowseFab({
    get viewportEl() {
      return masonry.viewportEl;
    },
  });

  const form = new BrowseForm();

  // ---

  $effect(() => {
    if (window.innerWidth < 600) {
      document.documentElement.style.setProperty("--left-panel-width", "0px");
    }
  });

  const handleToggleLeftPanel = () => {
    const root = document.documentElement;
    const property = getComputedStyle(root).getPropertyValue("--left-panel-width");

    if (!Boolean(property.trim())) {
      root.style.setProperty("--left-panel-width", "0px");
    } else {
      root.style.removeProperty("--left-panel-width");
    }
  };
</script>

<svelte:head>
  <title>Browse — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      <span>首頁</span>
    </a>

    <h1 class="page-header-title">瀏覽圖片</h1>
  </header>

  <main class="slide-up">
    <div class="left-panel-spacer"></div>

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
    </div>

    <aside class="left-panel">
      <div class="left-panel-viewport">
        <header>
          <h2>探索與靈感</h2>
          <p>共 {data.total} 張</p>
        </header>

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

        <div>
          <label class="field-row">
            <span class="field-label">圖片牆欄位</span>
            <Select stretch size="md" bind:value={masonry.columns} options={columnOptions} />
          </label>
        </div>

        <footer>
          <a class="btn-primary" href={`/browse/player${form.queryString}`}>
            <IconPlayerPlayFilled size={16} />
            <span>播放</span>
          </a>
          <a class="btn-outlined" href={`/browse/compare${form.queryString}`}>
            <IconArrowsLeftRight size={16} />
            <span>比較</span>
          </a>
        </footer>
      </div>

      <button type="button" aria-label="開合搜尋與排序面板" title="開合搜尋與排序面板" onclick={handleToggleLeftPanel}>
        <div class="inverse-border"></div>
      </button>
    </aside>
  </main>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    align-items: stretch;
    overflow: hidden;
  }

  main {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }

  /* --- */

  .left-panel-spacer {
    width: var(--left-panel-width, 280px);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    @media (max-width: 600px) {
      width: 0px;
    }
  }

  aside.left-panel {
    position: absolute;
    top: 0;
    bottom: 0;
    overflow: visible;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    width: 280px;
    transform: translateX(calc(-100% + var(--left-panel-width, 280px)));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    @media (max-width: 600px) {
      width: calc(100% - 32px);
      transform: translateX(calc(-100% + var(--left-panel-width, 100%)));
    }
  }

  aside.left-panel > button {
    position: absolute;
    overflow: visible;
    top: 0;
    left: 100%;
    width: 32px;
    height: 100px;
    background-color: var(--bg-card);
    border-bottom-right-radius: 16px;
    border: 1px solid var(--border);
    border-top: 0px;
    border-left: 0px;

    & > .inverse-border {
      content: "";
      position: absolute;
      top: 100%;
      left: 0;
      width: 16px;
      /* 註1: 16px 小於 masonry 的 paddingX: 24，因此背景覆蓋不會覆蓋到圖片 */
      /* 註2: 16px 又剛好是極限，因為 borderRadius 要是 button 寬度的一半: 16px */
      height: 16px;
      background-color: var(--bg-card);

      &::after {
        content: "";
        position: absolute;
        inset: 0;
        background-color: var(--bg);
        border-top-left-radius: 16px;
        border: 1px solid var(--border);
        border-bottom: 0px;
        border-right: 0px;
      }
    }

    display: grid;
    place-items: center;

    &::after {
      content: "";
      display: block;
      width: 20%;
      height: 60%;
      background: var(--border);
      border-radius: 999px;
      transition:
        background 0.15s,
        transform 0.15s;
    }

    &:hover::after {
      background: var(--border-hover);
      scale: 1.05;
    }

    &:active::after {
      scale: 0.95;
    }
  }

  /* --- */

  .left-panel-viewport {
    position: relative;
    overflow-y: auto;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .left-panel-viewport > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0px 0.75rem;
    height: 2.5rem;
    min-height: 2.5rem;
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
    border-bottom-right-radius: 16px;
    background: var(--bg);

    & > h2 {
      font-size: 0.8125rem;
      font-weight: normal;
    }

    & > p {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
    }
  }

  .left-panel-viewport > div {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);

    & > .field-row {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    & > .field-row > .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-muted);
    }
  }

  .left-panel-viewport > footer {
    margin-top: auto;
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
    position: absolute;
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
