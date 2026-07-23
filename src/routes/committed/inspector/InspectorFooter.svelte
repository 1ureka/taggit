<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { getDraftsContext } from "../logic2/drafts.svelte";
  import { getRevertMarkContext } from "../logic2/reverts.svelte";
  import { getPointersContext } from "../logic2/pointers.svelte";

  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();

  const file = $derived(pointers.editing?.id ?? null);
  const marked = $derived(file !== null && reverts.isMarked(file));
</script>

{#if file !== null}
  <footer>
    {#if marked}
      <Button variant="outlined" style="flex: 1;" onclick={() => reverts.handleUnmark([file])}>取消退回</Button>
    {:else}
      <Button variant="outlined" style="flex: 1;" onclick={() => drafts.handleDiscardDraft([file])}>還原草稿</Button>
      <Button variant="destructive" style="flex: 1;" onclick={() => reverts.handleMark([file])}>
        退回暫存區
      </Button>
    {/if}
  </footer>
{/if}

<style>
  footer {
    display: flex;
    padding: 0.75rem;
    gap: 0.5rem;
    margin-top: auto;
  }
</style>
