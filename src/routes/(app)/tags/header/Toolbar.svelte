<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { TagQuery } from "$lib/query-spec";
  import Actions from "./Actions.svelte";
  import Filters from "./Filters.svelte";

  type Props = {
    /** 全局共用的操作鎖 */
    pending: boolean;
    /** 目前選取的標籤數量 */
    selectedCount: number;
    /** 可審查的標籤數量 */
    touchedCount: number;
    /** 點擊清空選取事件 */
    onclear: () => void;
    /** 點擊重新整理事件 */
    onrefresh: () => void;
    /** 前往審查流程事件 */
    onreview: () => void;
  };

  let { pending, selectedCount, touchedCount, onclear, onrefresh, onreview }: Props = $props();

  const query = $derived(TagQuery.fromSearchParams(page.url.searchParams));

  const handleQuery = (q: TagQuery) => {
    const qs = q.toSearchParams(new URLSearchParams(location.search)).toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };
</script>

<div>
  <Filters {query} {selectedCount} onchange={handleQuery} {onclear} />
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
