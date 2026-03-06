<script lang="ts">
  import { untrack } from "svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData } from "./$types.js";

  import { initSearch, handleSearchKeydown, resolveConfirm } from "./actions.js";
  import { uiStore } from "./stores.svelte.js";
  import EditorSearch from "./EditorSearch.svelte";
  import EditorSelectionDock from "./EditorSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  untrack(() => initSearch(data.recent.items, data.allTags));
</script>

<svelte:head>
  <title>Editor — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleSearchKeydown} />

<div class="page">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">搜尋圖片</span>
    <div class="editor-shortcuts">
      <span><span class="kbd">Ctrl A</span> 全選</span>
      <span><span class="kbd">Ctrl ⇧A</span> 全不選</span>
      <span><span class="kbd">Ctrl I</span> 反轉</span>
      <span><span class="kbd">Esc</span> 取消選取</span>
    </div>
  </header>

  <main class="page-content">
    <EditorSearch />
  </main>
</div>

<EditorSelectionDock />

{#if uiStore.pendingConfirm}
  <ConfirmModal
    message={uiStore.pendingConfirm.message}
    onconfirm={() => resolveConfirm(true)}
    oncancel={() => resolveConfirm(false)}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .editor-shortcuts {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-left: auto;
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .editor-shortcuts span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .page-content {
    flex: 1;
    overflow-y: auto;
    scrollbar-gutter: stable;
    min-height: 0;
  }
</style>
