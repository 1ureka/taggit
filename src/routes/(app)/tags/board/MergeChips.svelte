<script lang="ts">
  import type { Tag } from "$lib/database";
  import MergeChip from "./MergeChip.svelte";

  type Props = {
    /** 要呈現的標籤列表 */
    tags: Tag[];
    /** 目前啟用中的標籤名稱 */
    active: string;
    /** 點擊啟用事件 */
    onactive: (tag: Tag) => void;
    /** 點擊移除事件 */
    onremove: (tag: Tag) => void;
  };

  let { tags, active, onactive, onremove }: Props = $props();
</script>

<div>
  {#each tags as tag (tag.name)}
    <MergeChip {tag} active={tag.name === active} onactive={() => onactive(tag)} onremove={() => onremove(tag)} />
  {/each}
</div>

<style>
  div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
</style>
