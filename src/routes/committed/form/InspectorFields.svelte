<script lang="ts">
  import FieldsRevert from "./FieldsRevert.svelte";
  import FieldsEdit from "./FieldsEdit.svelte";
  import FieldsBatch from "./FieldsBatch.svelte";

  import { getPointersContext } from "../logic/pointers.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const pointers = getPointersContext();
  const reverts = getRevertMarkContext();
  const selection = getSelectionContext();

  const file = $derived(pointers.editing?.id ?? null);
</script>

{#if selection.active}
  <FieldsBatch />
{:else if file !== null}
  {#if reverts.isMarked(file)}
    <FieldsRevert {file} />
  {:else}
    <FieldsEdit {file} />
  {/if}
{/if}
