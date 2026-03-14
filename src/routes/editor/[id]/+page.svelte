<script lang="ts">
  import CircularProgress from "$lib/components/CircularProgress.svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import EditorPreview from "./EditorPreview.svelte";
  import EditorMetadata from "./EditorMetadata.svelte";
  import EditorForm from "./EditorForm.svelte";

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
      <div class="loading-display">
        <CircularProgress label="操作中…" />
      </div>
    {/if}
  </header>

  <main>
    <EditorPreview image={data.image} {loading} />

    <aside>
      <EditorForm image={data.image} bind:loading />

      <div class="separator"></div>

      <EditorMetadata image={data.image} />
    </aside>
  </main>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .loading-display {
    margin-left: auto;
  }

  main {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  aside {
    width: 300px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
  }
</style>
