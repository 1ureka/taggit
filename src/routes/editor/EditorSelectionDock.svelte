<script lang="ts">
  import { fly } from "svelte/transition";
  import { IconX, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import { createEditorSelectionDock } from "./editorSelectionDock.svelte.js";

  const ui = createEditorSelectionDock();

  let dockRating = $state(0);

  $effect(() => {
    ui.count;
    dockRating = 0;
  });
</script>

{#if ui.count > 0}
  <div class="selection-dock" transition:fly={{ y: 20, duration: 200, opacity: 0 }}>
    <div class="dock-inner">
      <button class="btn btn-ghost btn-sm dock-close" onclick={ui.handleCloseClick} title="取消選取">
        <IconX size={16} />
      </button>

      <span class="dock-count">已選取 {ui.count} 張</span>

      <div class="dock-separator"></div>

      <div
        class="dock-rating"
        style="--rating-color: color-mix(in oklch, var(--bg) 35%, var(--text)); --rating-color-active: var(--bg)"
      >
        <Rating bind:value={dockRating} size="1.125rem" onchange={ui.handleRatingChange} />
      </div>

      <div class="dock-separator"></div>

      <button class="btn btn-destructive btn-sm" onclick={ui.handleDeleteClick}>
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
    background: var(--text);
    color: var(--bg);
    border: 1px solid hsla(from var(--bg) h s l / 0.12);
    border-radius: calc(var(--radius) * 2);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.14),
      0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .dock-close {
    padding: 0.25rem;
    color: color-mix(in oklch, var(--bg) 65%, var(--text));
    background: transparent;
    border-color: transparent;
  }

  .dock-close:hover {
    background: hsla(from var(--bg) h s l / 0.07);
    border-color: transparent;
    color: var(--bg);
  }

  .dock-count {
    font-size: 0.8125rem;
    font-weight: 500;
    color: color-mix(in oklch, var(--bg) 65%, var(--text));
    white-space: nowrap;
  }

  .dock-separator {
    width: 1px;
    height: 1.25rem;
    background: hsla(from var(--bg) h s l / 0.15);
    flex-shrink: 0;
  }

  .dock-rating {
    display: flex;
    align-items: center;
  }

  .dock-inner :global(.btn-destructive:hover) {
    background: hsla(from var(--destructive) h s l / 0.1);
  }
</style>
