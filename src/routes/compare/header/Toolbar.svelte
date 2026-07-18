<script lang="ts">
  import Actions from "./Actions.svelte";
  import Filters from "./Filters.svelte";
</script>

<div>
  <Filters />
  <Actions />
</div>

<style>
  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0px 1rem;
    height: 3rem;
    border-bottom: var(--border-style);
  }
</style>
