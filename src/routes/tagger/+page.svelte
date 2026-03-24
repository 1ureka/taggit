<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import { ZoomPan } from "$lib/ui/zoom-pan.svelte.js";
  import { TaggerPage } from "./taggerPage.svelte.js";
  import { TaggerProgress } from "./taggerProgress.svelte.js";
  import { TaggerPreview } from "./taggerPreview.svelte.js";

  import TaggerList from "./TaggerList.svelte";
  import TaggerForm from "./TaggerForm.svelte";

  const zp = new ZoomPan();

  let { data }: { data: PageData } = $props();

  const page = new TaggerPage({
    get stagedFiles() {
      return data.stagedFiles;
    },
  });

  const progress = new TaggerProgress({
    get stagedFiles() {
      return data.stagedFiles;
    },
    get progress() {
      return page.progress;
    },
  });

  const preview = new TaggerPreview({
    get currentFile() {
      return page.currentFile;
    },
    onChangeImage: zp.handleContainerReset,
  });
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<svelte:window onmousemove={zp.handleWindowMousemove} onmouseup={zp.handleWindowMouseup} />

<div class="page">
  <header class="page-header">
    <a href="/" class="btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      <span>首頁</span>
    </a>

    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-bar-fill" style="width:{progress.progressPct}%"></div>
      </div>
      <span class="progress-text">{progress.progressLabel}</span>
    </div>
  </header>

  <main>
    <aside class="sidebar">
      <TaggerList
        stagedFiles={data.stagedFiles}
        bind:currentFile={page.currentFile}
        bind:selectedFiles={page.selectedFiles}
      />
    </aside>

    <figure>
      {#if page.currentFile}
        <div
          class="preview-container"
          class:dragging={zp.isDragging}
          class:loading={preview.imageLoading}
          onwheel={zp.handleContainerWheel}
          onmousedown={zp.handleContainerMousedown}
          ondblclick={zp.handleContainerReset}
          onkeydown={zp.handleContainerKeydown}
          tabindex="0"
          role="button"
          aria-label="圖片預覽區域：支援縮放 (Z/+/Scroll)、平移 (Arrows/Drag) 及重置 (Enter/Esc/Space)"
        >
          <img
            src={preview.previewSrc}
            alt={page.currentFile}
            draggable="false"
            style="transform:{zp.transform}"
            onload={preview.handleImageLoad}
          />
        </div>
      {:else}
        <div class="preview-container">
          <div class="empty">上傳新圖片或在側邊欄選擇圖片</div>
        </div>
      {/if}

      <figcaption>
        {page.currentFile || "未選取任何圖片"}
      </figcaption>
    </figure>

    <aside class="panel">
      <TaggerForm bind:selectedFiles={page.selectedFiles} bind:progress={page.progress} />

      <div class="separator"></div>

      <div class="shortcuts">
        {#snippet key(label: string, keys: string[])}
          <div>
            <div>
              {#each keys as k}
                <span class="kbd">{k}</span>
              {/each}
            </div>
            {label}
          </div>
        {/snippet}
        {@render key("切換圖片", ["←", "→"])}
        {@render key("評等", ["1", "-", "5"])}
        {@render key("聚焦標籤", ["T"])}
        {@render key("提交", ["Enter"])}
      </div>
    </aside>
  </main>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    min-width: 860px;
    height: 100vh;
    overflow: hidden;
  }

  /* --- */

  .progress-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 24rem;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--bg-active);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 3.5rem;
    text-align: right;
  }

  /* --- */

  main {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* --- */

  .sidebar {
    width: 220px;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-card);
    overflow: hidden;
  }

  /* --- */

  figure:has(.preview-container) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    min-width: 0;
  }

  .preview-container {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    transition: opacity 0s step-start;

    &.loading {
      opacity: 0.4;
      transition: opacity 0.2s step-end;
    }

    & > img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transform-origin: center center;
      user-select: none;
      pointer-events: none;
    }

    & > .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 0.875rem;
      color: var(--text-dim);
    }
  }

  .preview-container {
    & > img {
      transition: transform 0.1s ease-out;
    }

    &.dragging > img {
      transition: none;
    }
  }

  .preview-container {
    cursor: grab;
    user-select: none;

    &.dragging {
      cursor: grabbing;
    }

    &:has(.empty) {
      cursor: auto;
      user-select: auto;
    }
  }

  figcaption {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.6875rem;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    background: var(--bg-card);
    min-height: 1.75rem;
  }

  /* --- */

  .panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    overflow-y: auto;
  }

  .shortcuts {
    display: grid;
    grid-template-columns: max-content 1fr max-content 1fr;
    gap: 0.25rem 2rem;
    font-size: 0.6875rem;
    color: var(--text-muted);

    & > div {
      grid-column: span 2;
      display: grid;
      grid-template-columns: subgrid;
      align-items: center;
      gap: 0.25rem;
    }
  }
</style>
