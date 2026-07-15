<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";

  import { formatError } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";

  import Toolbar from "./header/Toolbar.svelte";
  import StagedList from "./list/StagedList.svelte";
  import Inspector from "./inspector/Inspector.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  import { emptyDraft, isTouched, commitDrafts, type Draft } from "./inspector/draft";
  import { buildEntry, computeNewTags, toggleEntry, toggleAllEntries } from "./review/reviewEntry";

  // ---

  let { data }: { data: PageData } = $props();

  /** 是否正在進行處理 */
  let pending = $state(false);
  /** 每張暫存圖片的本地暫存。只在選檔當下延遲建立，不主動刪除失效 key */
  let drafts = $state<Record<string, Draft>>({});
  /** 目前編輯中的暫存圖片，使用者的原始意圖，不主動清除 */
  let active = $state<string | null>(null);
  /** 審查對話框是否打開 */
  let reviewOpen = $state(false);
  /** 提交後的失敗匯總 */
  let failures = $state<Record<string, string>>({});
  /** 目前審查清單的勾選狀態，使用者的原始意圖，不主動清除 */
  const checkedFiles = new SvelteSet<string>();

  // ---

  /** 暫存圖片總數 */
  const fileCount = $derived(data.stagedFiles.length);
  /** 被編輯過的暫存圖片 */
  const touchedFiles = $derived(data.stagedFiles.filter((f) => drafts[f] && isTouched(drafts[f])));
  /** 目前編輯中的暫存圖片 */
  const activeFile = $derived(active !== null && data.stagedFiles.includes(active) ? active : null);
  /** 目前編輯中的暫存圖片的指標 */
  const activeIndex = $derived(activeFile !== null ? data.stagedFiles.indexOf(activeFile) + 1 : 0);
  /** 審查清單 */
  const reviewEntries = $derived.by(() => {
    return touchedFiles.map((f) => buildEntry(f, drafts[f], checkedFiles.has(f), pending, failures[f]));
  });
  /** 提交後會新增的標籤 */
  const newTags = $derived(computeNewTags(reviewEntries, data.existingTagNames));
  /** 被編輯過且可提交的暫存圖片 */
  const readyCount = $derived(reviewEntries.filter((e) => e.problem === null).length);

  // ---

  const setActiveFile = (file: string | null) => {
    if (file !== null) drafts[file] ??= emptyDraft();
    active = file;
  };

  // ---

  const handleSubmit = async () => {
    const filenames = reviewEntries.filter((e) => e.checked).map((e) => e.filename);
    if (filenames.length === 0 || pending) return;

    pending = true;
    try {
      const result = await commitDrafts(filenames.map((f) => ({ filename: f, draft: drafts[f] })));
      failures = Object.fromEntries(result);

      const okCount = filenames.length - result.size;
      for (const f of filenames) {
        if (result.has(f)) continue;
        delete drafts[f];
        checkedFiles.delete(f);
      }

      if (okCount > 0) addToast({ message: `已提交 ${okCount} 張圖片`, variant: "success" });
      if (result.size > 0) addToast({ message: `${result.size} 張提交失敗`, variant: "error" });
      if (result.size === 0) reviewOpen = false;

      await invalidateAll();
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      pending = false;
    }
  };

  // ---

  const handleOpenReview = () => {
    failures = {};
    reviewOpen = true;
  };

  const handleToggleReview = (filename: string) => {
    toggleEntry(checkedFiles, filename);
  };

  const handleToggleAllReview = () => {
    toggleAllEntries(checkedFiles, reviewEntries);
  };

  const handleEditFromReview = (filename: string) => {
    reviewOpen = false;
    setActiveFile(filename);
  };

  const handlePreviewFromReview = (filename: string) => {
    addToast({ message: `（尚未實作）大圖預覽：${filename}`, variant: "info" });
  };

  const handleReviewClose = () => {
    if (!pending) reviewOpen = false;
  };

  // ---

  const handleClearDraft = () => {
    if (activeFile === null) return;
    drafts[activeFile] = emptyDraft();
  };

  const handleCloseInspector = () => {
    setActiveFile(null);
  };

  // ---

  const handleSelectFile = (file: string) => {
    setActiveFile(file);
  };
</script>

<svelte:head>
  <title>Tagger</title>
</svelte:head>

<div class="page">
  <Toolbar {fileCount} touchedCount={touchedFiles.length} {readyCount} onreview={handleOpenReview} />

  <div class="body">
    <StagedList
      files={data.stagedFiles}
      isTouched={(f) => touchedFiles.includes(f)}
      {activeFile}
      onselect={handleSelectFile}
    />

    {#if activeFile !== null && drafts[activeFile]}
      <Inspector
        bind:draft={drafts[activeFile]}
        {activeFile}
        {activeIndex}
        {fileCount}
        {pending}
        onclear={handleClearDraft}
        onclose={handleCloseInspector}
      />
    {:else}
      <div class="empty-inspector">從左側選一張暫存圖片開始編輯</div>
    {/if}
  </div>
</div>

<ReviewModal
  open={reviewOpen}
  entries={reviewEntries}
  {newTags}
  {pending}
  onclose={handleReviewClose}
  onsubmit={handleSubmit}
  onedit={handleEditFromReview}
  onpreview={handlePreviewFromReview}
  ontoggle={handleToggleReview}
  ontoggleall={handleToggleAllReview}
/>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .empty-inspector {
    flex: 1;
    display: grid;
    place-items: center;
    font: var(--font-body1);
    color: var(--color-text-muted);
  }
</style>
