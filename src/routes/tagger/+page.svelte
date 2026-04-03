<script lang="ts">
  import { IconArrowBackUp, IconCheck } from "@tabler/icons-svelte";
  import { IconRefresh, IconTrash, IconUpload } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import ImageList from "$lib/components/ImageList.svelte";
  import { imgSrc } from "$lib/client/api.js";

  import { ZoomPan } from "$lib/ui/zoom-pan.svelte.js";
  import { TaggerPage } from "./taggerPage.svelte.js";
  import { TaggerProgress } from "./taggerProgress.svelte.js";
  import { TaggerPreview } from "./taggerPreview.svelte.js";
  import { TaggerListSelect, TaggerListActions } from "./taggerList.svelte.js";
  import { TaggerForm } from "./taggerForm.svelte.js";

  let { data }: { data: PageData } = $props();

  const stagedFileList = $derived(
    data.stagedFiles.map((filename) => ({ id: filename, name: filename, imgSrc: imgSrc(filename, "sm") })),
  );

  // ---

  const zp = new ZoomPan();

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

  // ---

  const listSelect = new TaggerListSelect({
    get stagedFiles() {
      return data.stagedFiles;
    },
    get currentFile() {
      return page.currentFile;
    },
    set currentFile(v) {
      page.currentFile = v;
    },
    get currentIndex() {
      return page.currentIndex;
    },
    get selectedFiles() {
      return page.selectedFiles;
    },
    set selectedFiles(v) {
      page.selectedFiles = v;
    },
  });

  const listActions = new TaggerListActions();

  // ---

  const preview = new TaggerPreview({
    get currentFile() {
      return page.currentFile;
    },
    onChangeImage: zp.handleContainerReset,
  });

  // ---

  const form = new TaggerForm({
    get selectedFiles() {
      return page.selectedFiles;
    },
    set selectedFiles(v) {
      page.selectedFiles = v;
    },
    get progress() {
      return page.progress;
    },
    set progress(v) {
      page.progress = v;
    },
  });
</script>

<svelte:head>
  <title>新增圖片 — Taggit</title>
</svelte:head>

<svelte:window
  onmousemove={zp.handleWindowMousemove}
  onmouseup={zp.handleWindowMouseup}
  onkeydown={form.handleWindowKeydown}
/>

<main class="slide-up">
  <aside class="left-panel">
    <header>
      <div>
        <h2>待審查列表</h2>
        {#if listSelect.countLabel}
          <span class="badge">{listSelect.countLabel}</span>
        {/if}
        {#if listSelect.selectedLabel}
          <span class="badge">{listSelect.selectedLabel}</span>
        {/if}
      </div>

      <button
        class="btn-icon"
        class:pending={listActions.pending}
        title="重新載入列表"
        aria-label="重新載入列表"
        onclick={listActions.handleRefreshClick}
        disabled={listActions.pending}
      >
        <IconRefresh size={14} />
      </button>
    </header>

    <ImageList
      items={stagedFileList}
      currentIndex={page.currentIndex}
      selectedIds={page.selectedFiles}
      emptyLabel="沒有待審查的圖片"
      listLabel="待審查圖片列表"
      onKeydown={listSelect.handleListKeydown}
      onClickItem={listSelect.handleListClick}
    />

    <section aria-label="當前進度">
      <div class="progress-bar">
        <div style="width:{progress.progressPct}%"></div>
      </div>
      <span class="progress-text">{progress.progressLabel}</span>
    </section>

    <footer>
      <label class="btn-outlined" class:pending={listActions.pending}>
        <IconUpload size={14} />
        <span>加入圖片</span>
        <input
          type="file"
          accept="image/*"
          multiple
          class="visually-hidden"
          onchange={listActions.handleUploadChange}
          disabled={listActions.pending}
        />
      </label>
    </footer>
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

  <aside class="right-panel">
    <form onsubmit={form.handleFormSubmit} onreset={form.handleFormReset}>
      <header>
        <h2>編輯屬性</h2>
        <button class="btn-icon" type="reset" title="重置所有欄位" aria-label="重置所有欄位">
          <IconArrowBackUp size={18} />
        </button>
      </header>

      <div class="form-fields">
        <div class="field-rating">
          <Rating name="rating" bind:value={form.rating} size="1.5rem" />
        </div>

        <div class="separator"></div>

        <div class="field-tags">
          <Autocomplete bind:tags={form.tags} variant="top" placeholder="輸入標籤..." />
        </div>
      </div>

      <footer>
        <button
          class="btn-primary"
          type="submit"
          name="intent"
          value="commit"
          class:pending={form.pending}
          disabled={form.pending}
        >
          <IconCheck size={16} />
          <span>提交<kbd>Ctrl + S</kbd></span>
        </button>
        <button
          class="btn-destructive"
          type="submit"
          name="intent"
          value="delete"
          class:pending={form.pending}
          disabled={form.pending}
        >
          <IconTrash size={16} />
          <span>刪除<kbd>Ctrl + D</kbd></span>
        </button>
      </footer>
    </form>
  </aside>
</main>

<style>
  main {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow-x: auto;
  }

  aside header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0px 0.75rem;
    height: 2.5rem;
    border-bottom: var(--border-style);
  }

  /* --- */

  .left-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border-right: var(--border-style);
    background: var(--bg-card);
    overflow: hidden;
  }

  .left-panel > header {
    & > div:has(h2) {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    & > div:has(h2) > h2 {
      font-size: var(--font-size-body2);
      font-weight: 600;
      color: var(--text-muted);
    }

    & > button {
      padding: 0.125rem;
    }
  }

  .left-panel > footer {
    padding: 0.625rem 0.75rem;
    border-top: var(--border-style);

    & > label {
      width: 100%;
    }

    & > label:has(:focus-visible) {
      outline: 2px solid hsl(from var(--ring) h s l / 0.2);
      outline-offset: -2px;
    }
  }

  .left-panel > section[aria-label="當前進度"] {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.75rem;
    height: 2.5rem;
    padding: 0px 0.75rem;
    background: var(--bg-card);
    border-top: var(--border-style);

    & > .progress-bar {
      height: 4px;
      background: var(--bg-active);
      border-radius: 2px;
      overflow: hidden;

      & > div {
        height: 100%;
        background: var(--accent);
        border-radius: 2px;
        transition: width 0.3s ease;
      }
    }

    & > .progress-text {
      font-size: var(--font-size-caption);
      color: var(--text-muted);
      white-space: nowrap;
      text-align: right;
    }
  }

  /* --- */

  figure:has(.preview-container) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    min-width: 280px;
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
      font-size: var(--font-size-body1);
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
    padding: 0.375rem 0.75rem;
    font-size: var(--font-size-caption);
    color: var(--text-dim);
    border-top: var(--border-style);
    background: var(--bg-card);
    min-height: 1.75rem;
  }

  /* --- */

  .right-panel {
    width: 280px;
    min-width: 280px;
    border-left: var(--border-style);
    background: var(--bg-card);
  }

  .right-panel > form {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .right-panel > form > header {
    & > h2 {
      font-size: var(--font-size-body2);
      font-weight: 600;
      color: var(--text-muted);
    }

    & > button {
      padding: 0.125rem;
    }
  }

  .right-panel > form > .form-fields {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem;

    & .field-rating {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem 0px;
    }

    & .field-tags {
      flex: 1;
    }
  }

  .right-panel > form > footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: var(--border-style);
    padding: 0.75rem;

    & > button {
      justify-content: space-between;
      flex: 1;
      min-width: 0;
    }

    & > button > span {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    & > button > span > kbd {
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.8em;
    }
  }
</style>
