<script lang="ts">
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createFilterContext } from "./logic/filter.svelte";
  import { createPinnedContext } from "./logic/pinned.svelte";
  import { createOperationsContext } from "./logic/operations.svelte";

  import Toolbar from "./header/Toolbar.svelte";
  import Panel from "./list/Panel.svelte";
  import Cards from "./cards/Cards.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  createFilterContext();
  createPinnedContext();
  createOperationsContext();
</script>

<svelte:head>
  <title>Compare</title>
</svelte:head>

<div>
  <Toolbar />
  <Panel>
    <Cards />
  </Panel>
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
</style>
