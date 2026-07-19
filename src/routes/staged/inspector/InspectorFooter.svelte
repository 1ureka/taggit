<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { getEditorContext } from "../logic/editor.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  const editor = getEditorContext();
  const operations = getOperationsContext();

  const clearStatus = $derived(operations.pending ? "disabled" : undefined);
  const deleteStatus = $derived(operations.pending ? "pending" : undefined);
</script>

<footer>
  <Button variant="outlined" status={clearStatus} onclick={editor.handleClear}>清空草稿</Button>
  <Button variant="destructive" status={deleteStatus} onclick={editor.handleDelete}>刪除此張</Button>
</footer>

<style>
  footer {
    padding: 0.75rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: stretch;
    gap: 0.5rem;
    margin-top: auto;
  }
</style>
