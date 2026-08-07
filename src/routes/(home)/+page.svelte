<script lang="ts">
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createFilterContext } from "./logic/filter.svelte";
  import { createLayoutContext } from "./logic/layout.svelte";
  import { createDetailContext } from "./logic/detail.svelte";

  import ExplorePanel from "./panel/ExplorePanel.svelte";
  import MasonryWall from "./cards/MasonryWall.svelte";
  import DetailModal from "./detail/DetailModal.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  createFilterContext();
  createLayoutContext();
  createDetailContext();
</script>

<svelte:head>
  <title>Taggit</title>
</svelte:head>

<main>
  <ExplorePanel>
    <MasonryWall />
  </ExplorePanel>
</main>

<DetailModal />

<style>
  main {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }
</style>
