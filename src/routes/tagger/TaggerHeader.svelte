<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import { fileStore } from "./stores.svelte.js";

  let processed = $derived(fileStore.total - fileStore.list.length);
  let progressPct = $derived(fileStore.total > 0 ? Math.round((processed / fileStore.total) * 100) : 0);
  let progressLabel = $derived(`${processed}/${fileStore.total} (${fileStore.list.length} 剩餘)`);
</script>

<header class="page-header">
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
</style>
