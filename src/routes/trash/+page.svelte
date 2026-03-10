<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import { TrashContext, setTrashContext } from "./context.svelte.js";
  import TrashForm from "./TrashForm.svelte";
  import TrashList from "./TrashList.svelte";
  import TrashPagination from "./TrashPagination.svelte";
  import TrashSelectionDock from "./TrashSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  const proxy = {
    get files() {
      return data.files;
    },
    set files(v) {
      data.files = v;
    },
    get total() {
      return data.total;
    },
    set total(v) {
      data.total = v;
    },
    get pages() {
      return data.pages;
    },
    set pages(v) {
      data.pages = v;
    },
  };

  const ctx = setTrashContext(new TrashContext());
  ctx.files = proxy.files;
  ctx.total = proxy.total;
  ctx.pages = proxy.pages;
</script>

<svelte:head>
  <title>垃圾桶 — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">垃圾桶</span>
    <div class="trash-shortcuts">
      <span><span class="kbd">Ctrl A</span> 全選</span>
      <span><span class="kbd">Ctrl ⇧A</span> 全不選</span>
      <span><span class="kbd">Ctrl I</span> 反轉</span>
      <span><span class="kbd">Esc</span> 取消選取</span>
    </div>
  </header>

  <main class="page-content">
    <div class="slide-up">
      <TrashForm />
      <TrashList />
      <TrashPagination />
    </div>
  </main>
</div>

<TrashSelectionDock />

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .trash-shortcuts {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-left: auto;
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .trash-shortcuts span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .page-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .page-content > .slide-up {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    padding-bottom: 5rem;
  }
</style>
