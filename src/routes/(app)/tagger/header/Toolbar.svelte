<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 有本地修改、可送去審查的張數 */
    reviewCount: number;
    /** 前往審查流程時的處理函式 */
    onreview: () => void;
  };

  let { reviewCount, onreview }: Props = $props();
</script>

<div class="toolbar">
  <!-- TODO: SessionProgress 佔位，之後補上今天已提交張數等統計 -->
  <div class="progress-slot"></div>

  <Button variant="primary" status={reviewCount === 0 ? "disabled" : undefined} onclick={onreview}>
    檢視待提交的變更 ({reviewCount})
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

  .progress-slot {
    flex: 1;
    min-width: 0;
  }
</style>
