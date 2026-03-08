<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import CircularProgress from "$lib/components/CircularProgress.svelte";
  import { createTaggerProgress } from "./taggerProgress.svelte.js";

  const ui = createTaggerProgress();
</script>

<header class="page-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <div class="tagger-progress">
    <div class="progress-bar">
      <div class="progress-bar-fill" style="width:{ui.progressPct}%"></div>
    </div>
    <span class="tagger-progress-text">{ui.progressLabel}</span>
  </div>
  <div class="tagger-loading-indicators">
    {#if ui.loading}
      <CircularProgress label="操作中…" />
    {/if}
    {#if ui.imageLoading}
      <CircularProgress label="圖片載入中…" />
    {/if}
  </div>
</header>

<style>
  .tagger-progress {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 24rem;
  }

  .tagger-progress-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 3.5rem;
    text-align: right;
  }

  .tagger-loading-indicators {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
    flex-shrink: 0;
  }
</style>
