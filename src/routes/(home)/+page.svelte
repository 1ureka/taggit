<script lang="ts">
  import { navigating } from "$app/state";
  import type { PageData } from "./$types.js";

  import { IconPlayerPlay, IconArrowsShuffle, IconX, IconEditFilled } from "$lib/icons";
  import Select from "$lib/components/Select.svelte";
  import FilterFields from "$lib/components/FilterFields.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Tags from "$lib/components/Tags.svelte";
  import ScrollButton from "$lib/components/ScrollButton.svelte";
  import InverseRadius from "$lib/components/InverseRadius.svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";

  import { Masonry } from "$lib/virtualizer/masonry.svelte.js";
  import { BrowseForm } from "./browseForm.svelte.js";
  import { BrowseModal } from "./browseModal.svelte.js";

  const columnOptions = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 欄` }));

  const breakpoints = [
    { width: 1600, cols: 5, p: 24, g: 6 },
    { width: 1200, cols: 4, p: 24, g: 6 },
    { width: 900, cols: 3, p: 24, g: 6 },
    { width: 600, cols: 2, p: 12, g: 6 },
    { width: 0, cols: 2, p: 6, g: 4 },
  ];

  // ---

  let { data }: { data: PageData } = $props();

  let paddingX = $state(24);
  let paddingY = $state(24);
  let gap = $state(6);

  const masonry = new Masonry({
    get items() {
      return data.items;
    },
    get paddingX() {
      return paddingX;
    },
    get paddingY() {
      return paddingY;
    },
    get gap() {
      return gap;
    },
  });

  const handleResize = () => {
    const breakpoint = breakpoints.find((b) => window.innerWidth >= b.width)!;
    masonry.columns = breakpoint.cols;
    paddingX = breakpoint.p;
    paddingY = breakpoint.p;
    gap = breakpoint.g;
  };

  $effect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  if (typeof window !== "undefined") {
    handleResize();
  }

  const form = new BrowseForm();

  const modal = new BrowseModal({
    get items() {
      return data.items;
    },
  });

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
  <title>Taggit</title>
</svelte:head>

<main class="slide-up">
  <div class="left-panel-spacer"></div>

  <section class="masonry-viewport" aria-label="篩選結果" bind:this={masonry.viewportEl}>
    {#if data.total === 0 && !navigating.to}
      <p>找不到符合的圖片，請調整篩選條件，或在上方的導航選單中前往新增圖片</p>
    {/if}

    {#snippet card({ item }: { item: (typeof masonry.masonryItems)[number] })}
      <button type="button" onclick={() => modal.handleTriggerClick(item.id)} aria-label="查看 {item.name} 詳情">
        <figure>
          <img
            src={imgSrc(item.id, "md")}
            style={blurhashStyle({ fit: "cover", blurhash: item.blurhash, width: item.width, height: item.height })}
            alt={item.name}
            decoding="async"
          />

          <figcaption>
            <h3 class="ellipsis">{item.name}</h3>
            <Rating value={item.rating} size="1rem" readonly />
            <Tags tags={item.tags} nowrap />
          </figcaption>
        </figure>
      </button>
    {/snippet}

    <ul class="masonry" aria-label="圖片牆" style:height="{masonry.masonryHeight}px">
      {#each masonry.masonryItems as item (item.id)}
        <li class="masonry-item" style={item.style}>
          {@render card({ item })}
        </li>
      {/each}
    </ul>

    <ScrollButton viewportEl={masonry.viewportEl} />
  </section>

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
          <Select bind:value={masonry.columns} options={columnOptions} stretch />
        </label>
      </div>

      <footer>
        <a class="btn-primary" href={`/player${form.queryString}`}>
          <IconPlayerPlay size={16} />
          <span>播放</span>
        </a>
        <a class="btn-outlined" href={`/compare${form.queryString}`}>
          <IconArrowsShuffle size={16} />
          <span>比較</span>
        </a>
      </footer>
    </div>

    <button type="button" aria-label="開合探索面板" title="開合探索面板" onclick={handleToggleLeftPanel}>
      <InverseRadius corner="bottom-left" size="16px" />
      <!-- 註1: 16px 小於 masonry 的 paddingX: 24，因此背景覆蓋不會覆蓋到圖片 -->
      <!-- 註2: 16px 又剛好是極限，因為 borderRadius 要是 button 寬度的一半: 16px -->
    </button>
  </aside>
</main>

{#snippet modelContent(record: NonNullable<typeof modal.record>)}
  <article class="modal-content">
    <header>
      <button class="btn-icon" type="button" aria-label="關閉圖片詳細資訊" onclick={modal.handleClose}>
        <IconX size={16} />
      </button>

      <h2 class="ellipsis">{record.name}</h2>

      <a class="btn-primary btn-sm" href={`/editor?currentId=${record.id}`}>
        <IconEditFilled size={16} />
        <span>編輯</span>
      </a>
    </header>

    <div class="image-wrapper">
      <img
        src={imgSrc(record.id, "xl")}
        style={blurhashStyle({ fit: "cover", blurhash: record.blurhash, width: record.width, height: record.height })}
        alt={record.name}
        decoding="async"
      />

      <img class="blur-spread" aria-hidden="true" src={imgSrc(record.id, "md")} alt={record.name} decoding="async" />
    </div>

    <footer>
      <Rating value={record.rating} size="1.5rem" readonly />
      <Tags tags={record.tags} nowrap />
    </footer>
  </article>
{/snippet}

<Modal
  fullscreen
  label="圖片詳細資訊"
  open={modal.record !== null}
  onclose={modal.handleClose}
  overlayStyle="backdrop-filter: blur(8px); background: hsl(from var(--bg) h s l / 0.8);"
>
  <!-- 因為 open={modal.record !== null}，所以這裡可以安全地使用非空斷言 -->
  {@render modelContent(modal.record!)}
</Modal>

<style>
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
    border-right: var(--border-style);
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
    border: var(--border-style);
    border-top: 0px;
    border-left: 0px;
  }

  aside.left-panel > button {
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
    border-bottom: var(--border-style);
    border-right: var(--border-style);
    border-bottom-right-radius: 16px;
    background: var(--bg);

    & > h2 {
      font-size: var(--font-size-body1);
      font-weight: normal;
    }

    & > p {
      font-family: var(--font-mono);
      font-size: var(--font-size-caption);
      color: var(--text-dim);
    }
  }

  .left-panel-viewport > div {
    padding: 0.75rem;
    border-bottom: var(--border-style);

    & > .field-row {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    & > .field-row > .field-label {
      font-size: var(--font-size-body2);
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
    border-top: var(--border-style);

    & > a {
      justify-content: space-between;
    }

    & > a > span {
      flex: 1;
      text-align: center;
    }
  }

  /* --- */

  section.masonry-viewport {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;

    & > ul.masonry {
      position: relative;
    }
  }

  li.masonry-item {
    display: block;
  }

  li.masonry-item > button {
    position: relative;
    display: grid;
    place-items: stretch;
    width: 100%;
    height: 100%;
    border-radius: var(--radius);
    overflow: hidden;

    transition: scale 0.15s;
    &:active {
      scale: 0.98;
    }

    @media (max-width: 600px) {
      border-radius: calc(var(--radius) * 0.5);
    }
  }

  li.masonry-item > button > figure {
    min-width: 0;

    & > img {
      position: absolute;
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      z-index: -1;
    }

    & > figcaption {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      height: 100%;
      padding: 0.5rem;
      gap: 0.25rem;

      & > h3 {
        font-size: var(--font-size-body1);
        font-weight: 500;
        color: var(--text);
        opacity: 0.75;
        text-align: left;
        margin-bottom: auto;
        max-width: 100%;
      }
    }
  }

  li.masonry-item > button > figure {
    & > img {
      scale: 1.001;
      transition: scale 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    & > figcaption {
      opacity: 0;
      background: linear-gradient(
        to bottom,
        hsl(from var(--bg-card) h s l / 0.8) 0%,
        hsl(from var(--bg-card) h s l / 0.3) 35%,
        hsl(from var(--bg-card) h s l / 0.3) 65%,
        hsl(from var(--bg-card) h s l / 0.8) 100%
      );
      transition: opacity 0.2s;
    }
  }

  li.masonry-item > button:hover > figure {
    & > img {
      scale: 1.05;
    }

    & > figcaption {
      opacity: 1;
    }
  }

  li.masonry-item > button:focus-visible {
    outline: none;

    & > figure > img {
      scale: 1.05;
    }

    & > figure > figcaption {
      opacity: 1;
      outline: 4px solid hsl(from var(--ring) h s l / 0.5);
      outline-offset: -4px;
    }
  }

  section.masonry-viewport > p {
    text-align: center;
    color: var(--text-dim);
    font-size: var(--font-size-body1);
    padding: 3rem 0px;
  }

  /* --- */

  article.modal-content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    height: 100%;

    & > header,
    & > footer {
      padding: 0.75rem 1.5rem;
      @media (max-width: 600px) {
        padding: 0.75rem;
      }
    }
  }

  article.modal-content > header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;

    & > * {
      pointer-events: all;
    }

    & > button {
      justify-self: start;
    }

    & > a {
      justify-self: end;
    }

    & > h2 {
      font-size: var(--font-size-title2);
      font-weight: normal;
      opacity: 0.75;
    }
  }

  article.modal-content > .image-wrapper {
    padding: 0px 0.75rem;
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    position: relative;

    & > img {
      max-width: 100%;
      max-height: 100%;
      min-width: 0;
      min-height: 0;
      border-radius: var(--radius);
      pointer-events: all;
    }

    & > img:not(.blur-spread) {
      box-shadow: 0 0 10px var(--bg);
    }

    & > .blur-spread {
      position: absolute;
      filter: blur(30px);
      z-index: -1;
    }
  }
</style>
