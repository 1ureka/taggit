<script lang="ts">
  import type { Tag } from "$lib/database";
  import Chips from "./Chips.svelte";
  import Pagination from "./Pagination.svelte";

  type Props = {
    /** 要呈現的標籤列表 */
    items: Tag[];
    /** 目前查詢條件下的標籤總數 */
    total: number;
    /** 標籤狀態的查找表 */
    status: Map<string, "idle" | "group" | "delete" | "hidden">;
    /** 被選取標籤的集合 */
    selected: Set<string>;
    /** 此區域是否為當前拖放目標 */
    dropping: boolean;
    /** 點擊標籤事件 */
    ontoggle: (tag: Tag) => void;
    /** 標籤拖曳開始事件 */
    ondragstart: (tag: Tag) => void;
    /** 標籤拖曳結束事件 */
    ondragend: () => void;
    /** 此區域變成拖放目標事件 */
    ondragover: (e: DragEvent) => void;
    /** 此區域不再是拖放目標事件 */
    ondragleave: () => void;
    /** 此區域被拖放事件 */
    ondrop: (e: DragEvent) => void;
  };

  let {
    items,
    total,
    status,
    selected,
    dropping,
    ontoggle,
    ondragstart,
    ondragend,
    ondragover,
    ondragleave,
    ondrop,
  }: Props = $props();
</script>

<section class:dropping role="list" aria-label="標籤池" {ondragover} {ondragleave} {ondrop}>
  <Chips {items} {status} {selected} {ontoggle} {ondragstart} {ondragend} />
  <Pagination {total} />
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
