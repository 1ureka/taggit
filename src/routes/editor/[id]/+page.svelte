<script lang="ts">
  import CircularProgress from "$lib/components/CircularProgress.svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import EditorPreview from "./EditorPreview.svelte";
  import EditorPanel from "./EditorPanel.svelte";

  let { data }: { data: PageData } = $props();

  let loading = $state(false);
</script>

<svelte:head>
  <title>
    {data.image.name || data.image.id || "Editor"} — Image Manager
  </title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/editor" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      返回搜尋
    </a>
    <span class="page-header-title">
      {data.image.name || data.image.id || ""}
    </span>
    {#if loading}
      <div class="editor-header-loading">
        <CircularProgress label="操作中…" />
      </div>
    {/if}
  </header>

  <main class="page-content">
    <EditorPreview image={data.image} {loading} />
    <EditorPanel image={data.image} bind:loading />
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

  .editor-header-loading {
    margin-left: auto;
  }
</style>
