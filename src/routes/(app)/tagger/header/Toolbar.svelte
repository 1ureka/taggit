<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import SessionProgress from "./SessionProgress.svelte";

  type Props = {
    /** 暫存區圖片總數 */
    fileCount: number;
    /** 有本地修改、可送去審查的張數 */
    touchedCount: number;
    /** 可提交的張數 */
    readyCount: number;
    /** 前往審查流程時的處理函式 */
    onreview: () => void;
  };

  let { fileCount, touchedCount, readyCount, onreview }: Props = $props();
</script>

<div class="toolbar">
  <SessionProgress {fileCount} {touchedCount} {readyCount} />

  <Button variant="primary" status={touchedCount === 0 ? "disabled" : undefined} onclick={onreview}>
    檢視待提交的變更 ({touchedCount})
  </Button>
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
</style>
