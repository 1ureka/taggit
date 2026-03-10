<script lang="ts">
  import CircularProgress from "$lib/components/CircularProgress.svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import { EditorDetailContext, setEditorDetailContext } from "./context.svelte.js";
  import EditorPreview from "./EditorPreview.svelte";
  import EditorPanel from "./EditorPanel.svelte";

  let { data }: { data: PageData } = $props();

  const proxy = {
    get image() {
      return data.image;
    },
    set image(v) {
      data.image = v;
    },
  };

  const ctx = setEditorDetailContext(new EditorDetailContext());
  ctx.image = proxy.image;
</script>

<svelte:head>
  <title>
    {ctx.image?.name || ctx.image?.id || "Editor"} — Image Manager
  </title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/editor" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      返回搜尋
    </a>
    <span class="page-header-title">
      {ctx.image?.name || ctx.image?.id || ""}
    </span>
    {#if ctx.loading}
      <div class="editor-header-loading">
        <CircularProgress label="操作中…" />
      </div>
    {/if}
  </header>

  <main class="page-content">
    <EditorPreview />
    <EditorPanel />
  </main>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .page-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
