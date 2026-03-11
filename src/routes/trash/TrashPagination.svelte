<script lang="ts">
  import { createTrashPagination } from "./trashPagination.svelte.js";

  type Props = { page: number; pages: number };
  let { page, pages }: Props = $props();

  const ui = createTrashPagination({
    get pages() {
      return pages;
    },
  });
</script>

{#if pages > 1}
  <div class="trash-pagination">
    <button class="btn btn-sm" disabled={page <= 1} onclick={() => ui.handlePageClick(page - 1)}> 上一頁 </button>
    {#each Array.from({ length: Math.min(pages, 7) }, (_, i) => {
      if (pages <= 7) return i + 1;
      if (page <= 4) return i + 1;
      if (page >= pages - 3) return pages - 6 + i;
      return page - 3 + i;
    }) as p}
      <button class="btn btn-sm" class:btn-primary={p === page} onclick={() => ui.handlePageClick(p)}>
        {p}
      </button>
    {/each}
    <button class="btn btn-sm" disabled={page >= pages} onclick={() => ui.handlePageClick(page + 1)}> 下一頁 </button>
  </div>
{/if}

<style>
  .trash-pagination {
    display: flex;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
</style>
