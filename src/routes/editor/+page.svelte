<script lang="ts">
  import { IconArrowBackUp, IconCheck } from "@tabler/icons-svelte";
  import { IconFilter, IconRefresh, IconTrash } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import FilterFields from "$lib/components/FilterFields.svelte";
  import ImageList from "$lib/components/ImageList.svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { formatDate, formatSize } from "$lib/utils.js";

  import { ZoomPan } from "$lib/ui/zoom-pan.svelte.js";
  import { EditorPage } from "./editorPage.svelte.js";
  import { EditorPreview } from "./editorPreview.svelte.js";
  import { EditorListSelect, EditorListActions } from "./editorList.svelte.js";
  import { EditorForm } from "./editorForm.svelte.js";
  import { EditorFilter } from "./editorFilter.svelte.js";

  let { data }: { data: PageData } = $props();

  const committedFileIds = $derived(data.committedFiles.map(({ id }) => id));
  const committedFileList = $derived(data.committedFiles.map((item) => ({ ...item, imgSrc: imgSrc(item.id, "sm") })));

  // ---

  const zp = new ZoomPan();

  const page = new EditorPage({
    get imageIds() {
      return committedFileIds;
    },
    get currentRecord() {
      return data.currentRecord;
    },
  });

  // ---

  const listSelect = new EditorListSelect({
    get imageIds() {
      return committedFileIds;
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
    navigateTo: page.navigateTo,
  });

  const listActions = new EditorListActions({
    get pending() {
      return page.pending;
    },
    set pending(v) {
      page.pending = v;
    },
  });

  // ---

  const preview = new EditorPreview({
    get currentRecord() {
      return data.currentRecord;
    },
    onChangeImage: zp.handleContainerReset,
  });

  // ---

  const form = new EditorForm({
    get committedFiles() {
      return data.committedFiles;
    },
    get pending() {
      return page.pending;
    },
    set pending(v) {
      page.pending = v;
    },
    get currentRecord() {
      return data.currentRecord;
    },
    get selectedFiles() {
      return page.selectedFiles;
    },
  });

  // ---

  const filter = new EditorFilter({
    get pending() {
      return page.pending;
    },
    set pending(v) {
      page.pending = v;
    },
  });
</script>

<svelte:head>
  <title>管理圖片 — Taggit</title>
</svelte:head>

<svelte:window
  onmousemove={zp.handleWindowMousemove}
  onmouseup={zp.handleWindowMouseup}
  onkeydown={form.handleWindowKeydown}
/>

<main>
  <aside class="left-panel">
    <header>
      <div>
        <h2>已提交圖片列表</h2>
        {#if listSelect.countLabel}
          <span class="badge">{listSelect.countLabel}</span>
        {/if}
        {#if listSelect.selectedLabel}
          <span class="badge">{listSelect.selectedLabel}</span>
        {/if}
      </div>

      <button
        class="btn-icon"
        class:pending={page.pending}
        title="重新載入列表"
        onclick={listActions.handleRefreshClick}
        disabled={page.pending}
      >
        <IconRefresh size={14} />
      </button>
    </header>

    <ImageList
      items={committedFileList}
      currentIndex={page.currentIndex}
      selectedIds={page.selectedFiles}
      emptyLabel="沒有符合條件的圖片"
      listLabel="已提交圖片列表"
      onKeydown={listSelect.handleListKeydown}
      onClickItem={listSelect.handleListClick}
    />

    <footer>
      <button class="btn-outlined" onclick={filter.handleOpenClick}>
        <IconFilter size={14} />
        <span>篩選</span>
      </button>
    </footer>
  </aside>

  <figure>
    {#if data.currentRecord}
      <div
        class="preview-container"
        class:dragging={zp.isDragging}
        onwheel={zp.handleContainerWheel}
        onmousedown={zp.handleContainerMousedown}
        ondblclick={zp.handleContainerReset}
        onkeydown={zp.handleContainerKeydown}
        tabindex="0"
        role="button"
        aria-label="圖片預覽區域：支援縮放 (Z/+/Scroll)、平移 (Arrows/Drag) 及重置 (Enter/Esc/Space)"
      >
        {#key data.currentRecord.id}
          <img
            src={preview.previewSrc}
            alt={data.currentRecord.name}
            draggable="false"
            style={`transform:${zp.transform};${preview.previewStyle}`}
          />
        {/key}
      </div>
    {:else}
      <div class="preview-container">
        <div class="empty">使用篩選條件搜尋圖片或在側邊欄選擇圖片</div>
      </div>
    {/if}

    <figcaption>
      {data.currentRecord?.name || "未選取任何圖片"}
    </figcaption>
  </figure>

  <aside class="right-panel">
    <form onsubmit={form.handleFormSubmit} onreset={form.handleFormReset}>
      <header>
        <h2>編輯屬性</h2>
        <button class="btn-icon" type="reset" title="重置所有欄位">
          <IconArrowBackUp size={18} />
        </button>
      </header>

      <div class="form-fields">
        <div class="field-rating">
          <Rating name="rating" bind:value={form.rating} size="1.5rem" onchange={form.handleFieldChange} />
        </div>

        <div class="separator"></div>

        <div class="field-name">
          <label for="editor-name">名稱</label>
          <input
            id="editor-name"
            class="text-input"
            type="text"
            placeholder="圖片名稱..."
            bind:value={form.name}
            disabled={form.nameDisabled}
            oninput={form.handleFieldChange}
          />
        </div>

        <div class="separator"></div>

        <div class="field-tags">
          <Autocomplete
            bind:tags={form.tags}
            variant="top"
            placeholder="輸入標籤..."
            onchange={form.handleFieldChange}
          />
        </div>
      </div>

      <footer>
        <button
          class="btn-primary"
          type="submit"
          name="intent"
          value="save"
          class:pending={page.pending}
          disabled={form.saveDisabled}
        >
          <IconCheck size={16} />
          <span>存檔<kbd>Ctrl + S</kbd></span>
        </button>
        <button
          class="btn-destructive"
          type="submit"
          name="intent"
          value="delete"
          class:pending={page.pending}
          disabled={form.deleteDisabled}
        >
          <IconTrash size={16} />
          <span>刪除<kbd>Ctrl + D</kbd></span>
        </button>
      </footer>
    </form>

    {#if data.currentRecord}
      {@const committedAt = data.currentRecord.committedAt}
      {@const fileSize = data.currentRecord.fileSize}
      <dl>
        <dt>提交時間</dt>
        <dd class="ellipsis">{committedAt ? formatDate(committedAt) : "—"}</dd>

        <dt>檔案大小</dt>
        <dd class="ellipsis">{fileSize ? formatSize(fileSize) : "—"}</dd>

        {#if data.currentRecord.width && data.currentRecord.height}
          <dt>解析度</dt>
          <dd class="ellipsis">{data.currentRecord.width} × {data.currentRecord.height}</dd>
        {/if}
      </dl>
    {/if}
  </aside>
</main>

<Modal bind:open={filter.open} onclose={filter.handleClose} label="篩選條件">
  <form onsubmit={filter.handleFilterSubmit} onreset={filter.handleFilterReset}>
    <h3 class="modal-title">篩選條件</h3>

    <div class="modal-body">
      <FilterFields
        bind:search={filter.search}
        bind:includedTags={filter.includedTags}
        bind:excludedTags={filter.excludedTags}
        bind:rating={filter.rating}
        bind:ratingOp={filter.ratingOp}
        bind:sort={filter.sort}
        bind:order={filter.order}
        allowRandomSort={false}
      />
    </div>

    <div class="modal-actions">
      <button class="btn-ghost" type="reset">
        <span>重置</span>
      </button>
      <button class="btn-primary" type="submit" class:pending={page.pending} disabled={page.pending}>
        <span>篩選</span>
      </button>
    </div>
  </form>
</Modal>

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
    border-bottom: 1px solid var(--border);
  }

  /* --- */

  .left-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
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
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    & > button {
      padding: 0.125rem;
    }
  }

  .left-panel > footer {
    padding: 0.625rem 0.75rem;
    border-top: 1px solid var(--border);

    & > button {
      width: 100%;
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

    & > img {
      width: 100%;
      height: 100%;
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
    padding: 0.375rem 0.75rem;
    font-size: 0.6875rem;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    background: var(--bg-card);
    min-height: 1.75rem;
  }

  /* --- */

  .right-panel {
    width: 280px;
    min-width: 280px;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    display: flex;
    flex-direction: column;
  }

  .right-panel > form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .right-panel > form > header {
    & > h2 {
      font-size: 0.8125rem;
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
    padding: 0.75rem;
    overflow-y: auto;

    & .field-name {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;

      & > label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--text-muted);
      }
    }

    & .field-rating {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem 0px;
    }

    & .field-tags {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow-y: auto;
    }
  }

  .right-panel > form > footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--border);
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

  /* --- */

  .right-panel > dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    font-size: 0.75rem;
    margin: 0;
    padding: 0.75rem;
    border-top: 1px solid var(--border);

    & > dt {
      color: var(--text-dim);
      white-space: nowrap;
    }

    & > dd {
      font-family: var(--font-mono);
      color: var(--text-muted);
    }
  }

  /* --- */

  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .modal-body {
    margin-bottom: 1.25rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
