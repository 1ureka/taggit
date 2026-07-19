<script lang="ts">
  import { getDragContext } from "../logic/drag.svelte";
  import Chips from "./Chips.svelte";
  import Pagination from "./Pagination.svelte";

  const drag = getDragContext();
  const handlers = $derived(drag.zoneHandlers({ kind: "pool" }));
</script>

<section
  class:dropping={handlers.dropping}
  role="list"
  aria-label="標籤池"
  ondragover={handlers.ondragover}
  ondragleave={handlers.ondragleave}
  ondrop={handlers.ondrop}
>
  <Chips />
  <Pagination />
</section>

<style>
  section[role="list"] {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;

    transition: background-color 0.15s ease;

    &.dropping {
      background-color: var(--color-bg-hover);
    }
  }
</style>
