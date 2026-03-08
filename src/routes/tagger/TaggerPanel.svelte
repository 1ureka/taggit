<script lang="ts">
  import { IconCheck, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { getTaggerContext } from "./context.svelte.js";
  import { createTaggerPanel } from "./taggerPanel.svelte.js";

  const ctx = getTaggerContext();
  const ui = createTaggerPanel();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<aside class="tagger-panel">
  <div class="tagger-rating">
    <Rating bind:value={ctx.rating} size="1.5rem" />
  </div>
  <div class="separator"></div>

  <div class="tagger-tags" bind:this={ui.tagInputWrapEl}>
    <Autocomplete bind:tags={ctx.tags} variant="top" placeholder="輸入標籤..." onenter={ui.handleTagEnter} />
  </div>

  <div class="separator"></div>

  <div class="tagger-actions">
    <button class="btn btn-primary btn-sm" onclick={ui.handleCommitClick} disabled={ui.loading}>
      <IconCheck size={16} />
      {ui.loading ? "操作中…" : ui.selectedCount > 1 ? `提交 ${ui.selectedCount} 張` : "提交"}
    </button>
    <button class="btn btn-destructive btn-sm" onclick={ui.handleTrashClick} disabled={ui.loading}>
      <IconTrash size={16} />
      {ui.selectedCount > 1 ? `刪除 ${ui.selectedCount} 張` : "刪除"}
    </button>
  </div>

  <div class="separator"></div>

  <div class="tagger-shortcuts">
    <div>
      <div><span class="kbd">←</span><span class="kbd">→</span></div>
      切換圖片
    </div>
    <div>
      <div><span class="kbd">1</span>-<span class="kbd">5</span></div>
      評等
    </div>
    <div>
      <div><span class="kbd">T</span></div>
      聚焦標籤
    </div>
    <div>
      <div><span class="kbd">Enter</span></div>
      提交
    </div>
  </div>
</aside>

<style>
  .tagger-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    overflow-y: auto;
  }

  .tagger-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .tagger-tags {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .tagger-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tagger-actions :global(.btn) {
    flex: 1;
    min-width: 0;
  }

  .tagger-shortcuts {
    display: grid;
    grid-template-columns: max-content 1fr max-content 1fr;
    gap: 0.25rem 2rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .tagger-shortcuts > div {
    grid-column: span 2;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 0.25rem;
  }
</style>
