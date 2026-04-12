<script lang="ts">
  import { IconArrowBackUpDouble, IconArrowLeft, IconCheck } from "$lib/icons";
  import { IconFilter, IconReload } from "$lib/icons";
  import type { PageData } from "./$types.js";

  import type { ImageWithId } from "$lib/types.js";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import FilterFields from "$lib/components/FilterFields.svelte";
  import ImageList from "$lib/components/ImageList.svelte";
  import ImageCanvas from "$lib/components/ImageCanvas.svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { formatDate, formatSize } from "$lib/utils.js";

  import { EditorFilterModal } from "./editorFilter.svelte.js";
  import { EditorListSelect, EditorListActions } from "./editorList.svelte.js";
  import { EditorForm } from "./editorForm.svelte.js";
  import { EditorFormActions } from "./editorFormActions.svelte.js";

  let { data }: { data: PageData } = $props();

  /** 已提交的圖片 ID 列表 */
  const committedFileIds = $derived(data.committedFiles.map(({ id }) => id));
  /** 已提交的圖片列表（包含縮圖） */
  const committedFileList = $derived(data.committedFiles.map((item) => ({ ...item, imgSrc: imgSrc(item.id, "sm") })));

  /** 當前啟用的圖片索引 */
  const currentIndex = $derived.by(() => {
    const id = data.currentRecord?.id ?? null;
    if (!id) return null;

    const idx = committedFileIds.indexOf(id);
    return idx >= 0 ? idx : null;
  });

  /** 當前啟用的圖片資料 */
  const currentImage = $derived.by(() => {
    const record = data.currentRecord;
    if (!record) return undefined;

    return {
      src: imgSrc(record.id),
      alt: record.name,
      preview: { blurhash: record.blurhash, width: record.width, height: record.height },
    };
  });

  /** 編輯頁面的所有操作的共用鎖 */
  let pending = $state(false);

  // ---

  const modal = new EditorFilterModal();

  // ---

  const listSelect = new EditorListSelect({
    get imageIds() {
      return committedFileIds;
    },
    get currentRecord() {
      return data.currentRecord;
    },
    get currentIndex() {
      return currentIndex;
    },
  });

  const listActions = new EditorListActions({
    get pending() {
      return pending;
    },
    set pending(v) {
      pending = v;
    },
  });

  // ---

  const form = new EditorForm({
    get currentRecord() {
      return data.currentRecord;
    },
  });

  const formActions = new EditorFormActions({
    get form() {
      return form;
    },
    get committedFiles() {
      return data.committedFiles;
    },
    get currentRecord() {
      return data.currentRecord;
    },
    get selectedFiles() {
      return listSelect.selectedIds;
    },
    get pending() {
      return pending;
    },
    set pending(v) {
      pending = v;
    },
  });
</script>

<svelte:head>
  <title>管理圖片 — Taggit</title>
</svelte:head>

<svelte:window onkeydown={formActions.handleWindowKeydown} />

<main class="slide-up">
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
        class={{ "btn-icon": true, pending }}
        type="button"
        title="重新載入列表"
        aria-label="重新載入列表"
        onclick={listActions.handleRefreshClick}
        disabled={pending}
      >
        <IconReload size={14} />
      </button>
    </header>

    <ImageList
      items={committedFileList}
      {currentIndex}
      selectedIds={listSelect.selectedIds}
      emptyLabel="沒有符合條件的圖片"
      listLabel="已提交圖片列表"
      onKeydown={listSelect.handleListKeydown}
      onClickItem={listSelect.handleListClick}
    />

    <footer>
      <button type="button" class="btn-outlined" onclick={modal.handleOpenFilter}>
        <IconFilter size={14} />
        <span>篩選</span>
      </button>
    </footer>
  </aside>

  <figure>
    <ImageCanvas image={currentImage} emptyLabel="使用篩選條件搜尋圖片或在側邊欄選擇圖片" />

    <figcaption class="ellipsis" title={data.currentRecord?.name || "未選取任何圖片"}>
      {data.currentRecord?.name || "未選取任何圖片"}
    </figcaption>
  </figure>

  {#snippet imageDetails(currentRecord: ImageWithId)}
    <dl>
      <dt>提交時間</dt>
      <dd class="ellipsis">{currentRecord.committedAt ? formatDate(currentRecord.committedAt) : "—"}</dd>

      <dt>檔案大小</dt>
      <dd class="ellipsis">{currentRecord.fileSize ? formatSize(currentRecord.fileSize) : "—"}</dd>

      {#if currentRecord.width && currentRecord.height}
        <dt>解析度</dt>
        <dd class="ellipsis">{currentRecord.width} x {currentRecord.height}</dd>
      {/if}
    </dl>
  {/snippet}

  {#snippet editFields()}
    <div class="form-fields">
      <div class="field-rating">
        <Rating name="rating" bind:value={form.rating} size="1.5rem" />
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
          disabled={formActions.nameDisabled}
        />
      </div>

      <div class="separator"></div>

      <div class="field-tags">
        <Autocomplete bind:tags={form.tags} variant="top" placeholder="輸入標籤..." />
      </div>
    </div>
  {/snippet}

  <aside class="right-panel">
    <form onsubmit={formActions.handleFormSubmit} onreset={formActions.handleFormReset}>
      <header>
        <h2>編輯屬性</h2>
        <button class="btn-icon" type="reset" title="重置所有欄位" aria-label="重置所有欄位">
          <IconArrowBackUpDouble size={18} />
        </button>
      </header>

      {@render editFields()}

      <footer>
        <button
          class={{ "btn-primary": true, pending }}
          type="submit"
          name="intent"
          value="save"
          disabled={formActions.saveDisabled}
        >
          <IconCheck size={16} />
          <span>存檔<kbd>Ctrl + S</kbd></span>
        </button>
        <button
          class={{ "btn-destructive": true, pending }}
          type="submit"
          name="intent"
          value="delete"
          disabled={formActions.deleteDisabled}
        >
          <IconArrowLeft size={16} />
          <span>退回<kbd>Ctrl + D</kbd></span>
        </button>
      </footer>
    </form>

    {#if data.currentRecord}
      {@render imageDetails(data.currentRecord)}
    {/if}
  </aside>
</main>

<Modal bind:open={modal.open} onclose={modal.handleCloseFilter} label="篩選條件">
  <h3 class="modal-title">篩選條件</h3>

  <div class="modal-body">
    <FilterFields allowRandomSort={false} />
  </div>

  <div class="modal-actions">
    <button type="button" class="btn-primary" onclick={modal.handleFilterReset}>
      <span>重置</span>
    </button>
  </div>
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
    border-bottom: var(--border-style);
  }

  /* --- */

  .left-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
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

    & > button {
      width: 100%;
    }
  }

  /* --- */

  figure {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    min-width: 280px;
  }

  figcaption {
    display: block;
    text-align: center;
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
    padding: 0.75rem;
    overflow-y: auto;

    & .field-name {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;

      & > label {
        font-size: var(--font-size-body2);
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

  /* --- */

  .right-panel > dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    font-size: var(--font-size-caption);
    margin: 0;
    padding: 0.75rem;
    border-top: var(--border-style);

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
    font-size: var(--font-size-title2);
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
