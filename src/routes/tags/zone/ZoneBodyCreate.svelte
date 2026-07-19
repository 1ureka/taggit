<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { getBoardContext } from "../logic/board.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const board = getBoardContext();
  const selection = getSelectionContext();

  const oncreate = () => board.createGroup(selection.consume());
</script>

<p>拖曳到這裡建立<b>合併區</b></p>

<Button
  variant="outlined"
  status={selection.size === 0 ? "disabled" : undefined}
  onclick={oncreate}
  style="font: var(--font-caption)"
>
  從選取中建立
</Button>

<style>
  p {
    font: var(--font-body2);
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }
</style>
