<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createSamplesContext } from "./logic/samples.svelte";
  import { createQueryContext } from "./logic/query.svelte";
  import { createScheduleContext } from "./logic/schedule.svelte";
  import { createSubmitContext } from "./logic/submit.svelte";
  import { createReviewContext } from "./logic/review.svelte";
  import { createGuardContext } from "./logic/guard.svelte";

  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import Tabs from "./header/Tabs.svelte";
  import ReviewModal from "./header/ReviewModal.svelte";
  import Cards from "./body/Cards.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  createSamplesContext();
  const query = createQueryContext();
  createScheduleContext();
  createSubmitContext();
  createReviewContext();
  const guard = createGuardContext();

  beforeNavigate(guard.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={guard.handleBeforeUnload} />

<svelte:head>
  <title>標籤清理工具</title>
</svelte:head>

<div class="container">
  <Toolbar>
    <Tabs />
    <RefreshButton pending={query.refreshing} onrefresh={query.handleRefresh} style="margin-left: auto;" />
    <ReviewModal />
  </Toolbar>
  <Cards />
</div>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
</style>
