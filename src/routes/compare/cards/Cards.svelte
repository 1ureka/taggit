<script lang="ts">
  import { getPinnedContext } from "../logic/pinned.svelte";
  import Card from "./Card.svelte";

  const pinned = getPinnedContext();
</script>

<div class="dock">
  {#if pinned.records.length === 0}
    <div class="empty">
      <p>按「隨機抽選」抽 N 張並排比較，或者從左側列表釘選</p>
    </div>
  {:else}
    {#each pinned.records as record (record.id)}
      <Card {record} />
    {/each}
  {/if}
</div>

<style>
  div.dock {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    padding-left: calc(16px + 0.5rem);
    overflow-x: auto;
    overflow-y: hidden;
  }

  div.dock:has(.empty) {
    align-items: center;
    justify-content: center;
  }

  div.dock > .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;

    & > p {
      font: var(--font-body1);
      color: var(--color-text-muted);
    }

    & > p:nth-of-type(2) {
      font: var(--font-caption);
    }
  }
</style>
