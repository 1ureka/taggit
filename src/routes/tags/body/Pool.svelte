<script lang="ts">
  import { isLeavingSelf } from "$lib/utils/dom";
  import { getDragContext } from "../logic/drag.svelte";
  import Chips from "./Chips.svelte";
  import Pagination from "./PoolPagination.svelte";

  const drag = getDragContext();
  const target = { kind: "pool" } as const;

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    drag.handleDragOver(target);
  };

  const handleDragLeave = (e: DragEvent) => {
    if (isLeavingSelf(e)) drag.handleDragLeave(target);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    drag.handleDrop(target);
  };
</script>

<section
  class:dropping={drag.isOver(target)}
  role="list"
  aria-label="標籤池"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
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
