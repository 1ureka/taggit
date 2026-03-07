<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import { ScrollContext, setScrollContext } from "./context.svelte.js";
  import Select from "$lib/components/Select.svelte";
  import ScrollForm from "./ScrollForm.svelte";
  import ScrollMasonry from "./ScrollMasonry.svelte";

  let { data }: { data: PageData } = $props();

  const proxy = {
    get items() {
      return data.items;
    },
    set items(v) {
      data.items = v;
    },
    get total() {
      return data.total;
    },
    set total(v) {
      data.total = v;
    },
  };

  const ctx = setScrollContext(new ScrollContext());
  ctx.items = proxy.items;
  ctx.total = proxy.total;

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
      <Select bind:value={ctx.columns} options={columnOptions} />
    </div>
  </header>

  <main class="page-content slide-up" bind:this={ctx.pageContentEl}>
    <ScrollForm />
    <ScrollMasonry />
  </main>
</div>

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
