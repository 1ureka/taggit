<script lang="ts">
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  let { previewPending }: { previewPending: boolean } = $props();
</script>

<header>
  <h2>檢視待送出的標籤變更</h2>
  <p>
    勾選要套用的操作後送出；刪除與合併會改動所有相關圖片，送出前請確認預估數字。
    {#if previewPending}
      <span><CircularProgress size="0.75rem" />正在更新預估…</span>
    {/if}
  </p>
</header>

<style>
  header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1rem 0.5rem;
    border-bottom: var(--border-style);
  }

  h2 {
    font: var(--font-title2);
    font-weight: 600;
  }

  p {
    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  p > span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: 0.375rem;
  }
</style>
