<script lang="ts">
  import FilterBar from "$lib/components/FilterBar.svelte";
  import { ScrollForm } from "./scrollForm.svelte.js";

  let { total }: { total: number } = $props();

  const ui = new ScrollForm();
</script>

<div class="filter-area">
  <FilterBar
    bind:selectedTags={ui.selectedTags}
    bind:rating={ui.rating}
    bind:ratingOp={ui.ratingOp}
    bind:sort={ui.sort}
    bind:order={ui.order}
    onchange={ui.handleFilterChange}
  />
  <div class="count">
    <span>{total} 張結果</span>
  </div>
</div>

<style>
  .filter-area {
    padding: 1rem 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .count {
    font-size: 0.75rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
</style>
