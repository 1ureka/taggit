<script lang="ts">
  import FilterBar from "$lib/components/FilterBar.svelte";
  import { getScrollContext } from "./context.svelte.js";
  import { createScrollForm } from "./scrollForm.svelte.js";

  const ctx = getScrollContext();
  const ui = createScrollForm();
</script>

<div class="scroll-filter-area">
  <FilterBar
    bind:selectedTags={ctx.selectedTags}
    bind:rating={ctx.rating}
    bind:ratingOp={ctx.ratingOp}
    bind:sort={ctx.sort}
    bind:order={ctx.order}
    onchange={ui.handleFilterChange}
  />
  <div class="scroll-result-count">
    <span>{ctx.total} 張結果</span>
  </div>
</div>

<style>
  .scroll-filter-area {
    padding: 1rem 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .scroll-result-count {
    font-size: 0.75rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
</style>
