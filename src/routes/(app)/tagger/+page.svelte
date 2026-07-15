<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";

  import { api } from "$lib/utils/request";
  import { formatError, isRecord } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";
  import { requestConfirm } from "$lib/widgets/confirm-events";

  import Toolbar from "./header/Toolbar.svelte";
  import ImportModal from "./header/ImportModal.svelte";
  import StagedList from "./list/StagedList.svelte";
  import Inspector from "./inspector/Inspector.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  import { emptyDraft, commitDrafts, isTouched, type Draft } from "./inspector/draft";
  import { buildReviewEntry, computeNewTags, toggleEntry, toggleAllEntries } from "./review/reviewEntry";
  import { importRecords, type ImportProgress, type ImportResult } from "./header/import";

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
  /** 匯入對話框是否打開 */
  let importOpen = $state(false);
  /** 匯入中的即時進度 */
  let importProgress = $state<ImportProgress | null>(null);
  /** 上一次匯入完成後的結果摘要 */
  let importResult = $state<ImportResult | null>(null);
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
    return touchedFiles.map((f) => buildReviewEntry(f, drafts[f], checkedFiles.has(f), pending, failures[f]));
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

  const handleOpenImport = () => {
    importProgress = null;
    importResult = null;
    importOpen = true;
  };

  const handleImportClose = () => {
    if (pending) return;
    importOpen = false;
    importProgress = null;
    importResult = null;
  };

  const handleImportFile = async (file: File) => {
    if (pending) return;

    let data: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isRecord(parsed) || Object.keys(parsed).length === 0) {
        addToast({ message: "JSON 必須是非空的物件", variant: "error" });
        return;
      }
      data = parsed;
    } catch {
      addToast({ message: "無法解析 JSON 檔案", variant: "error" });
      return;
    }

    pending = true;
    importProgress = { current: 0, total: Object.keys(data).length };
    try {
      importResult = await importRecords(data, (p) => (importProgress = p));
      await invalidateAll();
    } catch (e) {
      importResult = { imported: 0, skipped: 0, errors: [formatError(e)] };
    } finally {
      pending = false;
    }
  };

  // ---

  const handleClearDraft = () => {
    if (activeFile === null) return;
    drafts[activeFile] = emptyDraft();
  };

  const handleDeleteFile = async () => {
    if (activeFile === null || pending) return;
    const file = activeFile;

    const msg = `確定要永久刪除 ${file}？此操作無法復原。`;
    if (!(await requestConfirm(msg, { title: "永久刪除", action: "永久刪除" }))) return;

    const idx = data.stagedFiles.indexOf(file);
    const next = data.stagedFiles[idx + 1] ?? data.stagedFiles[idx - 1] ?? null;

    pending = true;
    try {
      const res = await api.del(`/api/staged/${encodeURIComponent(file)}`);
      if (!res.ok) {
        addToast({ message: "刪除失敗" + (res.error ? `: ${res.error}` : ""), variant: "error" });
        return;
      }

      delete drafts[file];
      setActiveFile(next);
      addToast({ message: `已永久刪除：${file}`, variant: "info" });

      await invalidateAll();
    } finally {
      pending = false;
    }
  };

  const handleCloseInspector = () => {
    setActiveFile(null);
  };

  // ---

  const handleSelectFile = (file: string) => {
    setActiveFile(file);
  };

  // ---

  const handleRefresh = async () => {
    if (pending) return;
    pending = true;
    try {
      await invalidateAll();
      addToast({ message: "暫存列表已更新", variant: "success" });
    } finally {
      pending = false;
    }
  };
</script>

<svelte:head>
  <title>Tagger</title>
</svelte:head>

<div class="page">
  <Toolbar
    {fileCount}
    touchedCount={touchedFiles.length}
    {readyCount}
    {pending}
    onrefresh={handleRefresh}
    onreview={handleOpenReview}
    onimport={handleOpenImport}
  />

  <div class="body">
    <StagedList files={data.stagedFiles} {drafts} {activeFile} onselect={handleSelectFile} />

    {#if activeFile !== null && drafts[activeFile]}
      <Inspector
        bind:draft={drafts[activeFile]}
        {activeFile}
        {activeIndex}
        {fileCount}
        {pending}
        onclear={handleClearDraft}
        ondelete={handleDeleteFile}
        onclose={handleCloseInspector}
      />
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

<ImportModal
  open={importOpen}
  {pending}
  progress={importProgress}
  result={importResult}
  onclose={handleImportClose}
  onimport={handleImportFile}
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
</style>
