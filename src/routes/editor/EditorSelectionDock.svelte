<!--
  EditorSelectionDock — bottom fixed dock for batch operations.
  Visible when at least one image is selected.
-->
<script lang="ts">
  import { fly } from "svelte/transition";
  import { IconX, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import { selectionStore } from "./stores.svelte.js";
  import { clearSelection, deleteSelected, rateSelected } from "./actions.js";

  let count = $derived(selectionStore.selected.size);

  // Visual-only rating value that resets each time the selection changes.
  // The actual batch-rate action is triggered via the onchange callback,
  // NOT via a reactive $effect — this avoids accidentally calling rateSelected
  // when the value is reset programmatically (e.g. selection cleared).
  let dockRating = $state(0);

  $effect(() => {
    count; // depend on count so we reset once per selection change
    dockRating = 0;
  });
</script>

{#if count > 0}
  <div class="selection-dock" transition:fly={{ y: 20, duration: 200, opacity: 0 }}>
    <div class="dock-inner">
      <button class="btn btn-ghost btn-sm dock-close" onclick={clearSelection} title="取消選取">
        <IconX size={16} />
      </button>

      <span class="dock-count">已選取 {count} 張</span>

      <div class="dock-separator"></div>

      <div class="dock-rating">
        <Rating bind:value={dockRating} size="1.125rem" onchange={rateSelected} />
      </div>

      <div class="dock-separator"></div>

      <button class="btn btn-destructive btn-sm" onclick={deleteSelected}>
        <IconTrash size={14} />
        刪除
      </button>
    </div>
  </div>
{/if}

<style>
  .selection-dock {
    position: fixed;
    bottom: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    pointer-events: auto;
  }

  .dock-inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: #ffffff;
    color: #000000;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: calc(var(--radius) * 2);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.14),
      0 1px 4px rgba(0, 0, 0, 0.08);
  }

  /* Close button overrides on white background */
  .dock-close {
    padding: 0.25rem;
    color: #555555;
    background: transparent;
    border-color: transparent;
  }

  .dock-close:hover {
    background: rgba(0, 0, 0, 0.07);
    border-color: transparent;
    color: #000000;
  }

  .dock-count {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #555555;
    white-space: nowrap;
  }

  .dock-separator {
    width: 1px;
    height: 1.25rem;
    background: rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
  }

  .dock-rating {
    display: flex;
    align-items: center;
  }

  /* Rating stars on white dock need dark colours */
  .dock-rating :global(.rating-star) {
    color: #aaaaaa;
  }

  .dock-rating :global(.rating-star.active) {
    color: #000000;
  }

  /* Delete button: keep red but re-anchor hover to white base */
  .dock-inner :global(.btn-destructive:hover) {
    background: rgba(239, 68, 68, 0.1);
  }
</style>
