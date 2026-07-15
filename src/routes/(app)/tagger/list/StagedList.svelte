<script lang="ts">
  import Chip from "$lib/components/display/Chip.svelte";
  import type { StagedEntry } from "./stagedEntry";

  type Props = {
    /** 暫存清單 */
    entries: StagedEntry[];
    /** 點擊某張暫存檔案 */
    onselect: (file: string) => void;
  };

  let { entries, onselect }: Props = $props();
</script>

<!-- TODO: 待重寫為卡片式 grid 佈局（比照 tagger-b StagedGrid，含縮圖、ready/blocked 標記與圖章模式）；資料投影已就緒 -->

<ul class="staged-list">
  {#each entries as entry (entry.filename)}
    <li>
      <button type="button" class:active={entry.current} onclick={() => onselect(entry.filename)}>
        <span class="name ellipsis">{entry.filename}</span>
        {#if entry.touched}
          <Chip variant="outlined" style="font: var(--font-caption); flex-shrink: 0;">已編輯</Chip>
        {/if}
      </button>
    </li>
  {:else}
    <li class="empty">暫存區目前沒有圖片</li>
  {/each}
</ul>

<style>
  .staged-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    list-style: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border-radius: var(--border-radius);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--color-bg-hover);
    }

    &.active {
      background: var(--color-bg-active);
    }
  }

  .name {
    flex: 1;
    min-width: 0;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
  }

  .empty {
    padding: 1rem 0.625rem;
    text-align: center;
    font: var(--font-body2);
    color: var(--color-text-muted);
  }
</style>
