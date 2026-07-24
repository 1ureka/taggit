<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();
  const selection = getSelectionContext();

  const file = $derived(pointers.editing?.id ?? null);
</script>

<footer>
  {#if selection.active}
    <div>測試 footer!</div>
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
</style>
