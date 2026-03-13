<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import BrowseForm from "./BrowseForm.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Browse — Image Manager</title>
</svelte:head>

<main class="page">
  <div class="container slide-up">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      返回首頁
    </a>

    <h1 class="title">水平瀏覽</h1>
    <p class="subtitle">設定篩選條件後開始瀏覽</p>

    <BrowseForm matchCount={data.matchCount} />
  </div>
</main>

<style>
  main.page {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .btn {
    margin-bottom: 1rem;
    width: fit-content;
  }

  .container {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }
</style>
