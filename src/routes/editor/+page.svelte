<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import { untrack } from "svelte";
  import type { PageData } from "./$types.js";

  import Pagination from "$lib/components/Pagination.svelte";
  import EditorForm from "./EditorForm.svelte";
  import EditorList from "./EditorList.svelte";
  import EditorSelectionDock from "./EditorSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  let selected = $state<Set<string>>(new Set());

  $effect(() => {
    const currentSelected = untrack(() => selected);
    const visibleIds = new Set(data.result.items.map((i) => i.id));
    if (currentSelected.size === 0) return;
    const next = new Set([...currentSelected].filter((id) => visibleIds.has(id)));
    if (next.size !== currentSelected.size) selected = next;
  });
</script>

<svelte:head>
  <title>Editor — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">搜尋圖片</span>
    <div class="shortcuts">
      <span><span class="kbd">Ctrl A</span> 全選</span>
      <span><span class="kbd">Ctrl ⇧A</span> 全不選</span>
      <span><span class="kbd">Ctrl I</span> 反轉</span>
      <span><span class="kbd">Esc</span> 取消選取</span>
    </div>
  </header>

  <main class="page-content">
    <div class="slide-up">
      <EditorForm />
      <EditorList
        items={data.result.items}
        total={data.result.total}
        page={data.result.page}
        pages={data.result.pages}
        bind:selected
      />
      <Pagination page={data.result.page} pages={data.result.pages} basePath="/editor" />
    </div>
  </main>
</div>

<EditorSelectionDock bind:selected />

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .shortcuts {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-left: auto;
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .shortcuts span {
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

  .page-content > .slide-up {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    padding-bottom: 5rem;
  }
</style>
