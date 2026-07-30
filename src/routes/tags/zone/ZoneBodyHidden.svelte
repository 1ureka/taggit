<script lang="ts">
  import type { Tag } from "$lib/database";
  import Chip from "$lib/components/display/Chip.svelte";
  import { getBoardContext } from "../logic/board.svelte";

  let { tags }: { tags: Tag[] } = $props();

  const board = getBoardContext();
</script>

<p>可見的變隱藏、隱藏的恢復可見</p>

{#snippet chip({ name, meta: { hidden } }: Tag)}
  <Chip variant="outlined" removable onclick={() => board.handleDetach([name])}>
    <span class="chip-name ellipsis">{name}</span>
    <span class="chip-note">{hidden ? "→ 可見" : "→ 隱藏"}</span>
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

  span.chip-note {
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
