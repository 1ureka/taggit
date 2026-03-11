<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import Select from "$lib/components/Select.svelte";
  import ScrollFab from "./ScrollFab.svelte";
  import ScrollForm from "./ScrollForm.svelte";
  import ScrollMasonry from "./ScrollMasonry.svelte";

  let { data }: { data: PageData } = $props();

  let columns = $state(3);
  let pageContentEl = $state<HTMLElement | null>(null);

  const columnOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
    value: n,
    label: `${n} 欄`,
  }));
</script>

<svelte:head>
  <title>Scroll — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">垂直瀏覽</span>
    <div class="select-wrapper">
      <Select bind:value={columns} options={columnOptions} />
    </div>
  </header>

  <main class="page-content slide-up" bind:this={pageContentEl}>
    <ScrollForm total={data.total} />
    <ScrollMasonry items={data.items} bind:columns {pageContentEl} />
  </main>
</div>

<ScrollFab {pageContentEl} />

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    align-items: stretch;
    overflow: hidden;
  }

  .page-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .select-wrapper {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
