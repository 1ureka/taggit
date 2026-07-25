<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";
  import { getSelectionDraftContext } from "../logic/selection-draft.svelte";

  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();
  const selection = getSelectionContext();
  const selectionDraft = getSelectionDraftContext();

  const file = $derived(pointers.editing?.id ?? null);
</script>

<footer>
  {#if selection.active}
    <Button
      variant="primary"
      style="flex: 1;"
      status={selection.count === 0 || !selectionDraft.dirty ? "disabled" : "default"}
      onclick={selectionDraft.handleApply}
    >
      套用
      {#if selection.count > 0}
        <div><span>{selection.count}</span></div>
      {/if}
    </Button>
  {:else if file !== null}
    {#if reverts.isMarked(file)}
      <Button variant="outlined" style="flex: 1;" onclick={() => reverts.handleUnmark([file])}>取消退回</Button>
    {:else}
      <Button variant="outlined" style="flex: 1;" onclick={() => drafts.handleDiscardDraft([file])}>還原草稿</Button>
      <Button variant="destructive" style="flex: 1;" onclick={() => reverts.handleMark([file])}>退回暫存區</Button>
    {/if}
  {/if}
</footer>

<style>
  footer {
    display: flex;
    padding: 0.75rem;
    gap: 0.5rem;
    margin-top: auto;
  }

  div {
    display: inline-flex;
    align-items: center;
    height: 0px;
    overflow: visible;
  }

  div > span {
    padding: 0 0.25rem;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }
</style>
