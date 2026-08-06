<script lang="ts">
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createQueryContext } from "./logic/query.svelte";
  import { createPinnedContext } from "./logic/pinned.svelte";
  import { createRevertContext } from "./logic/revert.svelte";

  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import QueryControls from "./header/QueryControls.svelte";
  import ShuffleControl from "./header/ShuffleControl.svelte";
  import Panel from "./body/Panel.svelte";
  import Cards from "./body/Cards.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  const query = createQueryContext();
  createPinnedContext();
  createRevertContext();
</script>

<svelte:head>
  <title>比較圖片 · Taggit</title>
</svelte:head>

<div class="container">
  <Toolbar>
    <QueryControls />
    <RefreshButton pending={query.refreshing} onrefresh={query.handleRefresh} style="margin-left: auto;" />
    <ShuffleControl />
  </Toolbar>

  <Panel>
    <Cards />
  </Panel>
</div>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
</style>
