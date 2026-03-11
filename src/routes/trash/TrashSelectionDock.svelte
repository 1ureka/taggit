<script lang="ts">
  import { IconTrash, IconRotate } from "@tabler/icons-svelte";
  import SelectionDock from "$lib/components/SelectionDock.svelte";
  import { createTrashSelectionDock } from "./trashSelectionDock.svelte.js";

  type Props = { selected: Set<string> };
  let { selected = $bindable() }: Props = $props();

  const ui = createTrashSelectionDock({
    get selected() {
      return selected;
    },
    set selected(v) {
      selected = v;
    },
  });
</script>

<SelectionDock count={ui.count} onclose={ui.handleCloseClick}>
  <button class="btn btn-sm dock-restore" onclick={ui.handleRestoreClick}>
    <IconRotate size={14} />
    還原
  </button>

  <button class="btn btn-destructive btn-sm" onclick={ui.handleDeleteClick}>
    <IconTrash size={14} />
    刪除
  </button>
</SelectionDock>

<style>
  .dock-restore {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--border);
  }

  .dock-restore:hover {
    background: hsla(from var(--bg) h s l / 0.05);
    color: var(--bg);
    border-color: var(--border-hover);
  }
</style>
