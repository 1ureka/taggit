<script lang="ts">
  import { getEditorContext } from "./store.svelte.js";
  import { createEditorPagination } from "./editorPagination.svelte.js";

  const ctx = getEditorContext();
  const ui = createEditorPagination();
</script>

{#if ctx.pages > 1}
  <div class="editor-pagination">
    <button class="btn btn-sm" disabled={ctx.page <= 1} onclick={() => ui.handlePageClick(ctx.page - 1)}>
      上一頁
    </button>
    {#each Array.from({ length: Math.min(ctx.pages, 7) }, (_, i) => {
      if (ctx.pages <= 7) return i + 1;
      if (ctx.page <= 4) return i + 1;
      if (ctx.page >= ctx.pages - 3) return ctx.pages - 6 + i;
      return ctx.page - 3 + i;
    }) as p}
      <button class="btn btn-sm" class:btn-primary={p === ctx.page} onclick={() => ui.handlePageClick(p)}>
        {p}
      </button>
    {/each}
    <button class="btn btn-sm" disabled={ctx.page >= ctx.pages} onclick={() => ui.handlePageClick(ctx.page + 1)}>
      下一頁
    </button>
  </div>
{/if}

<style>
  .editor-pagination {
    display: flex;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
</style>
