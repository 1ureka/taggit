<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { formatError } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";

  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewFooter from "./ReviewFooter.svelte";
  import ReviewHeader from "./ReviewHeader.svelte";
  import ReviewList from "./ReviewList.svelte";

  /** 審查清單上的一列 */
  export type ReviewEntry = {
    /** 該紀錄的對應檔名 */
    filename: string;
    /** 該紀錄的縮圖 src */
    imgSrc: string;
    /** 生效的名稱（暫存名稱或去副檔名的檔名） */
    name: string;
    /** 該紀錄的評分 */
    rating: number;
    /** 該紀錄的標籤 */
    tags: string[];
    /** 不可提交的原因（null = 可提交） */
    problem: string | null;
  };

  type Props = {
    /** 是否開啟審查清單對話框 */
    open: boolean;
    /** 要審查的紀錄清單 */
    entries: ReviewEntry[];
    /** 既有標籤名稱（含隱藏），用於判斷此次提交會不會產生新標籤 */
    existingTagNames: string[];
    /** 關閉請求（backdrop 點擊、Escape、取消鈕） */
    onclose: () => void;
    /** 執行提交，回傳失敗項目 filename -> 錯誤訊息 */
    submit: (filenames: string[]) => Promise<Map<string, string>>;
    /** 點擊紀錄名稱：關閉本 modal 並繼續編輯該張 */
    onedit: (filename: string) => void;
    /** 點擊紀錄圖片：開啟大圖預覽 */
    onpreview: (filename: string) => void;
  };

  let { open, entries, existingTagNames, onclose, submit, onedit, onpreview }: Props = $props();

  // ---

  const includes = new SvelteSet<string>();

  let failures = $state<Record<string, string>>({});
  let pending = $state(false);

  /** 目前勾選的項目提交後會新建立的標籤（不存在於既有標籤中） */
  const newTags = $derived.by(() => {
    const existing = new Set(existingTagNames);
    const result = new Set<string>();

    for (const e of entries) {
      if (!includes.has(e.filename)) continue;
      for (const t of e.tags) {
        const trimmed = t.trim();
        if (trimmed && !existing.has(trimmed)) result.add(trimmed);
      }
    }

    return [...result];
  });

  // ---

  const isCheckable = (entry: ReviewEntry) => entry.problem === null && !pending;

  const toggle = (filename: string) => {
    if (includes.has(filename)) includes.delete(filename);
    else includes.add(filename);
  };

  const toggleAll = () => {
    const eligible = entries.filter(isCheckable);
    const allSelected = eligible.length > 0 && eligible.every((e) => includes.has(e.filename));
    for (const e of eligible) {
      if (allSelected) includes.delete(e.filename);
      else includes.add(e.filename);
    }
  };

  // ---

  const handleClose = () => {
    if (!pending) onclose();
  };

  const handleSubmit = async () => {
    if (includes.size === 0 || pending) return;
    pending = true;
    try {
      const fails = await submit([...includes]);
      failures = Object.fromEntries(fails);

      if (fails.size === 0) onclose();

      for (const f of [...includes]) if (!fails.has(f)) includes.delete(f);
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      pending = false;
    }
  };

  // ---

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal {open} onclose={handleClose} aria-label="檢視待提交的變更" containerProps={{ style: containerStyle }}>
  <ReviewHeader />

  {#if entries.length === 0}
    <p class="empty">目前沒有任何暫存的變更。</p>
  {:else}
    <ReviewList
      {entries}
      checked={includes}
      {onedit}
      {onpreview}
      ontoggle={toggle}
      ontoggleall={toggleAll}
      {isCheckable}
      isFailure={(entry) => failures[entry.filename]}
    />
  {/if}

  <ReviewFooter
    total={entries.length}
    checked={includes.size}
    {newTags}
    {pending}
    oncancel={handleClose}
    onsubmit={handleSubmit}
  />
</Modal>

<style>
  .empty {
    font: var(--font-body1);
    color: var(--color-text-muted);
    padding: 2.5rem 1rem;
    text-align: center;
  }
</style>
