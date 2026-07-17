<script lang="ts">
  import type { TagQuery } from "$lib/query-spec";
  import Actions from "./Actions.svelte";
  import Filters from "./Filters.svelte";

  type Props = {
    /** 全局共用的操作鎖 */
    pending: boolean;
    /** 目前的查詢值物件 */
    query: TagQuery;
    /** 目前選取的標籤數量 */
    selectedCount: number;
    /** 可審查的標籤數量 */
    touchedCount: number;
    /** 查詢參數改變事件 */
    onquery: (query: TagQuery) => void;
    /** 點擊清空選取事件 */
    onclear: () => void;
    /** 點擊重新整理事件 */
    onrefresh: () => void;
    /** 前往審查流程事件 */
    onreview: () => void;
  };

  let { pending, query, selectedCount, touchedCount, onquery, onclear, onrefresh, onreview }: Props = $props();
</script>

<div>
  <Filters {query} {selectedCount} onchange={onquery} {onclear} />
  <Actions {pending} {touchedCount} {onrefresh} {onreview} />
</div>

<style>
  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0px 1rem;
    height: 3rem;
    border-bottom: var(--border-style);
  }
</style>
