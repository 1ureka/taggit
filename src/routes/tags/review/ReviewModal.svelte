<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import type { ReviewEntry } from "./reviewEntry";
  import ReviewHeader from "./ReviewHeader.svelte";
  import ReviewFooter from "./ReviewFooter.svelte";
  import ReviewList from "./ReviewList.svelte";

  type Props = {
    /** 是否開啟審查對話框 */
    open: boolean;
    /** 待送出的操作清單 */
    entries: ReviewEntry[];
    /** 是否正在送出 */
    pending: boolean;
    /** 目前勾選的項目數量 */
    checkedCount: number;
    /** 目前可提交的項目數量 */
    readyCount: number;
    /** 關閉對話框事件 */
    onclose: () => void;
    /** 送出事件 */
    onsubmit: () => void;
    /** 點擊操作勾選框事件 */
    ontoggle: (name: string) => void;
    /** 點擊全選勾選框事件 */
    ontoggleall: () => void;
    /** 捨棄單筆操作（自畫布移除） */
    ondiscard: (name: string) => void;
  };

  let { open, entries, pending, checkedCount, readyCount, onclose, onsubmit, ontoggle, ontoggleall, ondiscard }: Props =
    $props();

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal {open} {onclose} aria-label="檢視待送出的標籤變更" containerProps={{ style: containerStyle }}>
  <ReviewHeader />

  {#if entries.length === 0}
    <p class="empty">目前沒有任何未送出的標籤操作。</p>
  {:else}
    <ReviewList {entries} {checkedCount} {readyCount} {pending} {ontoggle} {ontoggleall} {ondiscard} />
  {/if}

  <ReviewFooter checked={checkedCount} {pending} {onclose} {onsubmit} />
</Modal>

<style>
  .empty {
    font: var(--font-body1);
    color: var(--color-text-muted);
    padding: 2.5rem 1rem;
    text-align: center;
  }
</style>
