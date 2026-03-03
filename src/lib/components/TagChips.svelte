<script lang="ts">
  import { IconX } from "@tabler/icons-svelte";

  let {
    tags,
    onremove,
  }: {
    tags: string[];
    onremove?: (tag: string) => void;
  } = $props();
</script>

<div class="tag-chips" style="display:flex;flex-wrap:wrap;gap:0.25rem;">
  {#each tags as tag}
    {#if onremove}
      <button type="button" class="chip chip-removable" onclick={() => onremove?.(tag)}>
        {tag}
        <span class="chip-remove"><IconX size={12} /></span>
      </button>
    {:else}
      <span class="chip">{tag}</span>
    {/if}
  {/each}
</div>
