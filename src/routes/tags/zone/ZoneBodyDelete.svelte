<script lang="ts">
  import type { Tag } from "$lib/database";
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = {
    /** 刪除組的所有標籤 */
    tags: Tag[];
    /** 移除某標籤事件 */
    onremove: (name: string) => void;
  };

  let { tags, onremove }: Props = $props();
</script>

<p>拖進來的標籤會自所有圖片移除</p>

{#snippet chip({ name, count }: Tag)}
  <Chip variant="outlined" removable onclick={() => onremove(name)}>
    <span class="chip-name ellipsis">{name}</span>
    <span class="chip-count">{count}</span>
  </Chip>
{/snippet}

<div class="chips">
  {#each tags as tag (tag.name)}
    {@render chip(tag)}
  {:else}
    <span class="empty">（空）</span>
  {/each}
</div>

<style>
  p {
    font: var(--font-body2);
    color: var(--color-text-muted);
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }

  span.empty {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  div.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  span.chip-count {
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
