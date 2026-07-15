<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewFooter from "./ReviewFooter.svelte";
  import ReviewHeader from "./ReviewHeader.svelte";
  import ReviewList from "./ReviewList.svelte";

  /** 審查清單上的一列。勾選/失敗狀態由外部算好傳入，本元件純展示。 */
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
    /** 該紀錄的問題 */
    problem: string | null;
    /** 是否已被勾選 */
    checked: boolean;
    /** 是否不可勾選 */
    disabled: boolean;
  };

  type Props = {
    /** 是否開啟審查清單對話框 */
    open: boolean;
    /** 要審查的紀錄清單 */
    entries: ReviewEntry[];
    /** 目前勾選的項目提交後會新建立的標籤 */
    newTags: string[];
    /** 是否正在處理中 */
    pending: boolean;
    /** 關閉對話框事件 */
    onclose: () => void;
    /** 提交事件 */
    onsubmit: () => void;
    /** 點擊紀錄名稱事件 */
    onedit: (filename: string) => void;
    /** 點擊紀錄圖片事件 */
    onpreview: (filename: string) => void;
    /** 點擊紀錄勾選框事件 */
    ontoggle: (filename: string) => void;
    /** 點擊全選勾選框事件 */
    ontoggleall: () => void;
  };

  let { open, entries, newTags, pending, onclose, onsubmit, onedit, onpreview, ontoggle, ontoggleall }: Props =
    $props();

  const checkedCount = $derived(entries.filter((e) => e.checked).length);
  const checkableCount = $derived(entries.filter((e) => !e.disabled).length);
  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal {open} {onclose} aria-label="檢視待提交的變更" containerProps={{ style: containerStyle }}>
  <ReviewHeader />

  {#if entries.length === 0}
    <p>目前沒有任何暫存的變更。</p>
  {:else}
    <ReviewList {checkedCount} {checkableCount} {entries} {onedit} {onpreview} {ontoggle} {ontoggleall} />
  {/if}

  <ReviewFooter {checkedCount} {newTags} {pending} oncancel={onclose} {onsubmit} />
</Modal>

<style>
  p {
    font: var(--font-body1);
    color: var(--color-text-muted);
    padding: 2.5rem 1rem;
    text-align: center;
  }
</style>
