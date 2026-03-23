<script lang="ts">
  import { Pagination } from "$lib/ui/pagination.svelte.js";

  type Props = { page: number; pages: number; basePath: string };
  let { page, pages, basePath }: Props = $props();

  const ui = new Pagination({
    get pages() {
      return pages;
    },
    get basePath() {
      return basePath;
    },
  });
</script>

{#if pages > 1}
  <div class="pagination">
    <button class="btn-outlined btn-sm" disabled={page <= 1} onclick={() => ui.handlePageClick(page - 1)}>
      <span>上一頁</span>
    </button>
    {#each Array.from({ length: Math.min(pages, 7) }, (_, i) => {
      if (pages <= 7) return i + 1;
      if (page <= 4) return i + 1;
      if (page >= pages - 3) return pages - 6 + i;
      return page - 3 + i;
    }) as p}
      <button
        class="btn-sm"
        class:btn-outlined={p !== page}
        class:btn-primary={p === page}
        onclick={() => ui.handlePageClick(p)}
      >
        <span>{p}</span>
      </button>
    {/each}
    <button class="btn-outlined btn-sm" disabled={page >= pages} onclick={() => ui.handlePageClick(page + 1)}>
      <span>下一頁</span>
    </button>
  </div>
{/if}

<style>
  .pagination {
    display: flex;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
</style>
