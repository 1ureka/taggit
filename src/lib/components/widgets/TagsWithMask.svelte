<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = Omit<HTMLAttributes<HTMLDivElement>, "onselect"> & {
    /** 標籤清單 */
    tags: string[];
    /** 提供時標籤可點擊 */
    onselect?: (name: string) => void;
  };

  let { tags, onselect, ...rest }: Props = $props();
</script>

<div class="tags" {...rest}>
  {#each tags as tag (tag)}
    <Chip onclick={onselect ? () => onselect(tag) : undefined} style="flex-shrink: 0; max-width: 10rem">
      <span class="ellipsis">{tag}</span>
    </Chip>
  {/each}
</div>

<style>
  .tags {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.375rem;
    max-width: 100%;
    width: 100%;
    overflow: hidden;
    mask-image: linear-gradient(to right, black calc(100% - 3rem), transparent);
  }
</style>
