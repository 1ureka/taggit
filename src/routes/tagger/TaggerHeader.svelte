<script lang="ts">
  import { IconArrowLeft, IconTool } from "@tabler/icons-svelte";
  import { fileStore } from "./stores.svelte.js";
  import { openTools } from "./actions.js";

  let processed = $derived(fileStore.total - fileStore.list.length);
  let progressPct = $derived(fileStore.total > 0 ? Math.round((processed / fileStore.total) * 100) : 0);
  let progressLabel = $derived(`${processed}/${fileStore.total} (${fileStore.list.length} 剩餘)`);
</script>

<header class="tagger-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <div class="tagger-progress">
    <div class="progress-bar">
      <div class="progress-bar-fill" style="width:{progressPct}%"></div>
    </div>
    <span class="tagger-progress-text">{progressLabel}</span>
  </div>
  <div class="tagger-header-actions">
    <button class="btn btn-sm" onclick={openTools}>
      <IconTool size={16} />
      工具
    </button>
  </div>
</header>

<style>
  .tagger-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    z-index: 100;
  }

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

  .tagger-header-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }
</style>
