<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import type { PageData } from "./$types";

  import { isInEditable } from "$lib/utils/dom";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createSamplesContext } from "./logic/samples.svelte";
  import { createOperationsContext } from "./logic/operations.svelte";
  import { createScheduleContext } from "./logic/schedule.svelte";
  import { createFilterContext } from "./logic/filter.svelte";
  import { createReviewContext } from "./logic/review.svelte";

  import Toolbar from "./header/Toolbar.svelte";
  import Cards from "./cards/Cards.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  createSamplesContext();
  createOperationsContext();
  const schedule = createScheduleContext();
  createFilterContext();
  const review = createReviewContext();

  beforeNavigate(schedule.handleBeforeNavigate);

  function handleKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (schedule.touchedCount > 0) review.handleOpen();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onbeforeunload={schedule.handleBeforeUnload} />

<svelte:head>
  <title>標籤清理工具</title>
</svelte:head>

<div class="page">
  <Toolbar />
  <Cards />
</div>

<ReviewModal />

<style>
  div.page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
</style>
