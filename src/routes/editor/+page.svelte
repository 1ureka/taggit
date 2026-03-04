<script lang="ts">
  import { untrack } from "svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import { initSearch, handleSearchKeydown } from "./actions.js";
  import EditorSearch from "./EditorSearch.svelte";
  import EditorSelectionDock from "./EditorSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  untrack(() => initSearch(data.recent.items, data.allTags));
</script>

<svelte:head>
  <title>Editor — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleSearchKeydown} />

<header class="editor-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <span class="editor-title">搜尋圖片</span>
  <div class="editor-shortcuts">
    <span><span class="kbd">Ctrl A</span> 全選</span>
    <span><span class="kbd">Ctrl ⇧A</span> 全不選</span>
    <span><span class="kbd">Ctrl I</span> 反轉</span>
    <span><span class="kbd">Esc</span> 取消選取</span>
  </div>
</header>

<main class="editor-content-search">
  <EditorSearch />
</main>

<EditorSelectionDock />

<style>
  .editor-header {
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

  .editor-title {
    font-size: 0.875rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
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

  .editor-content-search {
    margin-top: 3rem;
    min-height: calc(100vh - 3rem);
  }
</style>
