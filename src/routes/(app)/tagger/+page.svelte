<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";

  import { imgSrc } from "$lib/image/client";
  import { formatError } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";

  import Toolbar from "./header/Toolbar.svelte";
  import StagedList from "./list/StagedList.svelte";
  import Inspector from "./inspector/Inspector.svelte";
  import ReviewModal, { type ReviewEntry } from "./review/ReviewModal.svelte";
  import { emptyDraft, isTouched, problemOf, stripExt, commitDrafts, type Draft } from "./inspector/draft";

  let { data }: { data: PageData } = $props();

  // 每張暫存圖片的本地暫存。只在選檔當下延遲建立，從不主動刪除失效 key——
  // 下面所有讀取一律以 data.stagedFiles 為準過濾，消失的檔案留下的殘影不會被讀到。
  let drafts = $state<Record<string, Draft>>({});

  const touchedFiles = $derived(data.stagedFiles.filter((f) => drafts[f] && isTouched(drafts[f])));

  // 目前檢視的圖片：currentFile 是使用者的原始選取意圖，永不被動清除；
  // 畫面一律讀 validCurrentFile（過濾掉已不在 stagedFiles 裡的選取）。
  let currentFile = $state<string | null>(null);
  const validCurrentFile = $derived(
    currentFile !== null && data.stagedFiles.includes(currentFile) ? currentFile : null,
  );
  const currentIndex = $derived(validCurrentFile !== null ? data.stagedFiles.indexOf(validCurrentFile) : -1);

  const selectFile = (file: string | null) => {
    if (file !== null) drafts[file] ??= emptyDraft();
    currentFile = file;
  };

  let pending = $state(false);
  let reviewOpen = $state(false);

  // 審查清單的勾選意圖，同樣從不主動清除失效 key；
  // reviewEntries 只把「當前合法且被勾選」的結果算進每筆資料，供 ReviewModal 純讀取。
  const checkedFiles = new SvelteSet<string>();
  let submitFailures = $state<Record<string, string>>({});

  const reviewEntries = $derived<ReviewEntry[]>(
    touchedFiles.map((f) => {
      const d = drafts[f];
      const problem = problemOf(d);
      const failure = submitFailures[f];
      return {
        filename: f,
        imgSrc: imgSrc(f, "sm"),
        name: d.name.trim() || stripExt(f),
        rating: d.rating,
        tags: d.tags,
        problem: problem ?? (failure ? `提交失敗：${failure}` : null),
        checked: problem === null && checkedFiles.has(f),
        disabled: problem !== null || pending,
      };
    }),
  );

  const newTags = $derived.by(() => {
    const existing = new Set(data.existingTagNames);
    const result = new Set<string>();
    for (const e of reviewEntries) {
      if (!e.checked) continue;
      for (const t of e.tags) {
        const trimmed = t.trim();
        if (trimmed && !existing.has(trimmed)) result.add(trimmed);
      }
    }
    return [...result];
  });

  const openReview = () => {
    submitFailures = {};
    reviewOpen = true;
  };

  const toggleReview = (filename: string) => {
    if (checkedFiles.has(filename)) checkedFiles.delete(filename);
    else checkedFiles.add(filename);
  };

  const toggleAllReview = () => {
    const eligible = reviewEntries.filter((e) => !e.disabled);
    const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
    for (const e of eligible) {
      if (allSelected) checkedFiles.delete(e.filename);
      else checkedFiles.add(e.filename);
    }
  };

  const submitReview = async () => {
    const filenames = reviewEntries.filter((e) => e.checked).map((e) => e.filename);
    if (filenames.length === 0 || pending) return;

    pending = true;
    try {
      const failures = await commitDrafts(filenames.map((f) => ({ filename: f, draft: drafts[f] })));
      submitFailures = Object.fromEntries(failures);

      const okCount = filenames.length - failures.size;
      for (const f of filenames) {
        if (failures.has(f)) continue;
        delete drafts[f];
        checkedFiles.delete(f);
      }
      if (okCount > 0) addToast({ message: `已提交 ${okCount} 張圖片`, variant: "success" });
      if (failures.size > 0) addToast({ message: `${failures.size} 張提交失敗`, variant: "error" });
      if (failures.size === 0) reviewOpen = false;

      await invalidateAll();
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      pending = false;
    }
  };

  const handleClearCurrent = () => {
    if (validCurrentFile === null) return;
    drafts[validCurrentFile] = emptyDraft();
  };

  const handleEditFromReview = (filename: string) => {
    reviewOpen = false;
    selectFile(filename);
  };

  const handlePreviewFromReview = (filename: string) => {
    // 大圖預覽（lightbox）還沒做，先給個提示
    addToast({ message: `（尚未實作）大圖預覽：${filename}`, variant: "info" });
  };

  const handleModalClose = () => {
    if (!pending) reviewOpen = false;
  };
</script>

<svelte:head>
  <title>Tagger</title>
</svelte:head>

<div class="page">
  <Toolbar reviewCount={touchedFiles.length} onreview={openReview} />

  <div class="body">
    <StagedList
      files={data.stagedFiles}
      isTouched={(f) => touchedFiles.includes(f)}
      currentFile={validCurrentFile}
      onselect={selectFile}
    />

    {#if validCurrentFile !== null && drafts[validCurrentFile]}
      <Inspector
        file={validCurrentFile}
        current={currentIndex + 1}
        total={data.stagedFiles.length}
        bind:draft={drafts[validCurrentFile]}
        {pending}
        onclear={handleClearCurrent}
        onclose={() => selectFile(null)}
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
  onclose={handleModalClose}
  onsubmit={submitReview}
  onedit={handleEditFromReview}
  onpreview={handlePreviewFromReview}
  ontoggle={toggleReview}
  ontoggleall={toggleAllReview}
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
