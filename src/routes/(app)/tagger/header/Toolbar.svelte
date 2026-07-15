<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import SessionProgress from "./SessionProgress.svelte";
  import { IconDatabase } from "$lib/icons";

  type Props = {
    /** 暫存區圖片總數 */
    fileCount: number;
    /** 有本地修改、可送去審查的張數 */
    touchedCount: number;
    /** 可提交的張數 */
    readyCount: number;
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 前往審查流程時的處理函式 */
    onreview: () => void;
    /** 開啟匯入對話框的處理函式 */
    onimport: () => void;
  };

  let { fileCount, touchedCount, readyCount, pending, onreview, onimport }: Props = $props();
</script>

<div class="toolbar">
  <SessionProgress {fileCount} {touchedCount} {readyCount} />

  <div class="actions">
    <Button variant="outlined" status={pending ? "disabled" : undefined} onclick={onimport}>
      <IconDatabase size={16} />
      <span>匯入紀錄</span>
    </Button>
    <Button variant="primary" status={touchedCount === 0 ? "disabled" : undefined} onclick={onreview}>
      檢視待提交的變更 ({touchedCount})
    </Button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 1rem;
    border-bottom: var(--border-style);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
