<script lang="ts">
  import { ImageQuery } from "$lib/query-spec";
  import Actions from "./Actions.svelte";
  import Filters from "./Filters.svelte";

  type Props = {
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 查詢值物件改變事件 */
    onquery: (query: ImageQuery) => void;
    /** 隨機抽選事件 */
    onshuffle: (count: number) => void;
    /** 重新整理事件 */
    onrefresh: () => void;
  };

  let { pending, onquery, onshuffle, onrefresh }: Props = $props();
</script>

<div>
  <Filters onchange={onquery} />
  <Actions {pending} {onshuffle} {onrefresh} />
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
