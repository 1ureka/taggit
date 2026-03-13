<script lang="ts">
  import AutocompleteCompact from "$lib/components/AutocompleteCompact.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import { CompareFilter } from "./compareFilter.svelte.js";

  type Props = { total: number };
  let { total }: Props = $props();

  const ui = new CompareFilter();
</script>

<div class="filter-bar">
  <AutocompleteCompact bind:tags={ui.filterTags} placeholder="標籤篩選..." onchange={ui.handleFilterChange} />
  <Rating bind:value={ui.filterMinRating} size="1rem" onchange={ui.handleFilterChange} />
  <span class="count">{total} 張</span>
</div>

<style>
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .count {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-dim);
    white-space: nowrap;
    margin-left: auto;
  }
</style>
