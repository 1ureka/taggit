<!--
  TrashSelectionDock — bottom fixed dock for batch operations.
  Visible when at least one image is selected.
-->
<script lang="ts">
  import { fly } from "svelte/transition";
  import { IconX, IconTrash, IconRotate } from "@tabler/icons-svelte";
  import { selectionStore } from "./stores.svelte.js";
  import { clearSelection, restoreSelected, deleteSelected } from "./actions.js";

  let count = $derived(selectionStore.selected.size);
</script>

{#if count > 0}
  <div class="selection-dock" transition:fly={{ y: 20, duration: 200, opacity: 0 }}>
    <div class="dock-inner">
      <button class="btn btn-ghost btn-sm dock-close" onclick={clearSelection} title="取消選取">
        <IconX size={16} />
      </button>

      <span class="dock-count">已選取 {count} 張</span>

      <div class="dock-separator"></div>

      <button class="btn btn-sm dock-restore" onclick={restoreSelected}>
        <IconRotate size={14} />
        還原
      </button>

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
    z-index: var(--z-dock);
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

  /* Restore button — inverted primary style (solid accent background on white dock) */
  .dock-restore {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--border);
  }

  .dock-restore:hover {
    background: hsla(from var(--bg) h s l/ 0.05);
    color: var(--bg);
    border-color: var(--border-hover);
  }

  /* Delete button hover on white dock */
  .dock-inner :global(.btn-destructive:hover) {
    background: hsla(from var(--destructive) h s l/ 0.1);
  }
</style>
