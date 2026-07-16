<script lang="ts">
  import { ImageQuery } from "$lib/query-spec";
  import Actions from "./Actions.svelte";
  import Filters from "./Filters.svelte";

  type Props = {
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 套用查詢：由頁面寫回 URL（保留 pinned）並重跑 load */
    onapply: (query: ImageQuery) => void;
    /** 隨機抽選 N 張 */
    onshuffle: (count: number) => void;
    /** 重新整理列表 */
    onrefresh: () => void;
  };

  let { pending, onapply, onshuffle, onrefresh }: Props = $props();
</script>

<div>
  <Filters {onapply} />
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
