<script lang="ts">
  import type { Tag } from "$lib/database";
  import { IconStarFilled, IconX } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import { getZonesContext, type Zone } from "../logic/zones.svelte";
  import { getMergeCountContext } from "../logic/merge-count.svelte";

  let { group }: { group: Extract<Zone, { kind: "group" }> } = $props();

  const zones = getZonesContext();
  const mergeCount = getMergeCountContext();

  const count = $derived(mergeCount.countOf(group.id));

  const setActive = (name: string) => zones.handleRename(group.id, name);
</script>

<div class="rename">
  <TextInput
    label="合併後的名稱"
    labelHidden
    maxlength={50}
    value={group.canonical}
    oninput={(e) => zones.handleRename(group.id, e.currentTarget.value)}
    style="flex: 1; min-width: 0;"
    {@attach tooltip({ content: "合併後的名稱", placement: "left" })}
  />

  <span class="rename-count">
    →
    {#if count === null}
      <span class="skeleton" aria-label="計算中">000</span>
    {:else}
      {count}
    {/if}
    張
  </span>
</div>

{#snippet chip({ name, count }: Tag)}
  {@const active = group.canonical === name}
  {@const defaultStyle = "background: var(--color-bg-card); padding: 0.1875rem; transition: all 0.15s ease;"}
  {@const activeBorder = "border-color: hsl(from var(--color-accent) h s l / 0.6);"}
  {@const activeBackground = "background: hsl(from var(--color-accent) h s l / 0.15);"}
  {@const style = active ? defaultStyle + activeBorder + activeBackground : defaultStyle}

  {@const activeLabel = `把 ${name} 設為合併後的名稱`}
  {@const removeLabel = `把 ${name} 移出這一堆`}

  <Chip variant="outlined" {style}>
    <span class="chip-action" class:active>
      <button type="button" title={activeLabel} aria-label={activeLabel} onclick={() => setActive(name)}>
        <IconStarFilled size={14} />
      </button>
    </span>

    <span class="chip-name ellipsis">{name}</span>
    <span class="chip-count">{count}</span>

    <span class="chip-action">
      <button type="button" title={removeLabel} aria-label={removeLabel} onclick={() => zones.handleDetach([name])}>
        <IconX size={14} />
      </button>
    </span>
  </Chip>
{/snippet}

<div class="chips">
  {#each group.tags as tag (tag.name)}
    {@render chip(tag)}
  {/each}
</div>

<style>
  div.rename {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    align-self: stretch;
    gap: 0.5rem;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }

  span.rename-count {
    flex-shrink: 0;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  div.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  span.chip-action {
    height: 0px;
    overflow: visible;
    display: flex;
    align-items: center;
  }

  span.chip-action > button {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem;
    color: var(--color-text-muted);
    transition: color 0.15s ease;

    &:hover {
      color: var(--color-text);
    }
  }

  span.chip-action.active > button {
    color: var(--color-accent);
  }

  span.chip-count {
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  span.skeleton {
    border-radius: calc(var(--border-radius) / 2);
  }
</style>
