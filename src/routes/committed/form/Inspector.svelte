<script lang="ts">
  import InspectorHeader from "./InspectorHeader.svelte";
  import InspectorFields from "./InspectorFields.svelte";
  import InspectorFooter from "./InspectorFooter.svelte";
  import InspectorImage from "./InspectorImage.svelte";

  import { getPointersContext } from "../logic/pointers.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const pointers = getPointersContext();
  const selection = getSelectionContext();

  const file = $derived(pointers.editing?.id ?? null);
</script>

{#if selection.active || file !== null}
  <aside>
    <InspectorHeader />
    <InspectorImage />
    <div>
      <InspectorFields />
      <InspectorFooter />
    </div>
  </aside>
{/if}

<style>
  aside {
    display: flex;
    flex-direction: column;
    width: 22rem;
    min-width: 22rem;
    min-height: 0;
    border-left: var(--border-style);
  }

  div {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
