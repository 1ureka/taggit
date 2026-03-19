<script lang="ts">
  import CircularProgress from "$lib/components/CircularProgress.svelte";

  type Props = {
    loading: boolean;
    imageLoading: boolean;
  };

  let { loading, imageLoading }: Props = $props();
</script>

<div class="indicators">
  {#if loading}
    <CircularProgress label="操作中…" />
  {/if}
  {#if imageLoading}
    <CircularProgress label="圖片載入中…" />
  {/if}
</div>

<style>
  .indicators {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
    flex-shrink: 0;
  }
</style>
