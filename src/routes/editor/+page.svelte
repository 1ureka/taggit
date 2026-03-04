<script lang="ts">
  import { untrack } from "svelte";
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
  <a href="/" class="btn btn-ghost btn-sm">首頁</a>
  <span class="editor-title">搜尋圖片</span>
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

  .editor-content-search {
    margin-top: 3rem;
    min-height: calc(100vh - 3rem);
  }
</style>
