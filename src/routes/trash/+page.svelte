<script lang="ts">
  import { untrack } from "svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData } from "./$types.js";

  import { initTrash, handleTrashKeydown, resolveConfirm } from "./actions.js";
  import { uiStore } from "./stores.svelte.js";
  import TrashSearch from "./TrashSearch.svelte";
  import TrashSelectionDock from "./TrashSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  untrack(() => initTrash(data.files, data.total, data.page, data.pages));
</script>

<svelte:head>
  <title>垃圾桶 — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleTrashKeydown} />

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
    <TrashSearch />
  </main>
</div>

<TrashSelectionDock />

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
</style>
