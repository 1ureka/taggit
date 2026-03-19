<script lang="ts">
  import { IconTrash, IconArrowBackUp } from "@tabler/icons-svelte";
  import SelectionDock from "$lib/components/SelectionDock.svelte";
  import { EditorSelectionDock } from "./editorSelectionDock.svelte.js";

  type Props = { selected: Set<string> };
  let { selected = $bindable() }: Props = $props();

  const ui = new EditorSelectionDock({
    get selected() {
      return selected;
    },
    set selected(v) {
      selected = v;
    },
  });
</script>

<SelectionDock count={ui.count} onclose={ui.handleCloseClick}>
  <button class="btn btn-sm dock-unstage" disabled={ui.loading} onclick={ui.handleUnstageClick}>
    <IconArrowBackUp size={14} />
    退回
  </button>

  <button class="btn btn-destructive btn-sm" disabled={ui.loading} onclick={ui.handleDeleteClick}>
    <IconTrash size={14} />
    刪除
  </button>
</SelectionDock>

<style>
  .dock-unstage {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--border);
  }

  .dock-unstage:hover {
    background: hsla(from var(--bg) h s l / 0.05);
    color: var(--bg);
    border-color: var(--border-hover);
  }
</style>
