<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
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
  {#if ui.loading}
    <div class="tagger-loading">
      <span class="tagger-loading-text">載入中...</span>
      <span class="tagger-spinner"></span>
    </div>
  {/if}
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

  .tagger-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    flex-shrink: 0;
  }

  .tagger-loading-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  @keyframes tagger-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .tagger-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--text-dim);
    border-top-color: var(--text);
    border-radius: 50%;
    animation: tagger-spin 0.6s linear infinite;
  }
</style>
