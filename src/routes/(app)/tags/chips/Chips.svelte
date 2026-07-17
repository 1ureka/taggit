<script lang="ts">
  import type { Tag } from "$lib/database";
  import Chip from "./Chip.svelte";

  type Props = {
    /** 要呈現的標籤列表 */
    items: Tag[];
    /** 標籤狀態的查找表 */
    status: Map<string, "idle" | "group" | "delete" | "hidden">;
    /** 被選取標籤的集合 */
    selected: Set<string>;
    /** 點擊標籤事件 */
    ontoggle: (tag: Tag) => void;
    /** 標籤拖曳開始事件 */
    ondragstart: (tag: Tag) => void;
    /** 標籤結束拖曳事件 */
    ondragend: () => void;
  };

  let { items, status, selected, ontoggle, ondragstart, ondragend }: Props = $props();

  let scrollerEl = $state<HTMLElement>();

  $effect(() => {
    items; // 換頁/篩選後資料一到就捲回頂端
    scrollerEl?.scrollTo({ top: 0 });
  });
</script>

<div bind:this={scrollerEl}>
  {#each items as tag (tag.name)}
    <Chip
      {tag}
      status={status.get(tag.name) ?? "idle"}
      selected={selected.has(tag.name)}
      onclick={() => ontoggle(tag)}
      ondragstart={() => ondragstart(tag)}
      {ondragend}
    />
  {:else}
    <p>沒有符合的標籤</p>
  {/each}
</div>

<style>
  div {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 0.375rem;
    padding: 0.75rem;
    min-height: 0;
    overflow-y: auto;
  }

  p {
    font: var(--font-body2);
    color: var(--color-text-muted);
  }
</style>
