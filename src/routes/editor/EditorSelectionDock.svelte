<script lang="ts">
  import { IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import SelectionDock from "$lib/components/SelectionDock.svelte";
  import { createEditorSelectionDock } from "./editorSelectionDock.svelte.js";

  const ui = createEditorSelectionDock();

  let dockRating = $state(0);

  $effect(() => {
    ui.count;
    dockRating = 0;
  });
</script>

<SelectionDock count={ui.count} onclose={ui.handleCloseClick}>
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
</SelectionDock>

<style>
  .dock-rating {
    display: flex;
    align-items: center;
  }

  .dock-separator {
    width: 1px;
    height: 1.25rem;
    background: hsla(from var(--bg) h s l / 0.15);
    flex-shrink: 0;
  }
</style>
