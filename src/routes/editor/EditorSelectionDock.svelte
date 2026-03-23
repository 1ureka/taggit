<script lang="ts">
  import { IconTrash } from "@tabler/icons-svelte";
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
  <button class="btn-destructive btn-sm" disabled={ui.loading} onclick={ui.handleDeleteClick}>
    <IconTrash size={14} />
    <span>退回暫存</span>
  </button>
</SelectionDock>
