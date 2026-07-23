<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createPreviewsContext } from "./logic/previews.svelte";
  import { createOperationsContext } from "./logic/operations.svelte";
  import { createQueryContext } from "./logic/query.svelte";
  import { createSelectionContext } from "./logic/selection.svelte";
  import { createBoardContext } from "./logic/board.svelte";
  import { createDragContext } from "./logic/drag.svelte";
  import { createReviewContext } from "./logic/review.svelte";

  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import Filters from "./header/Filters.svelte";
  import CleanLink from "./header/CleanLink.svelte";
  import Pool from "./chips/Pool.svelte";
  import ZoneContainer from "./zone/ZoneContainer.svelte";
  import ZoneHeader from "./zone/ZoneHeader.svelte";
  import ZoneBodyCreate from "./zone/ZoneBodyCreate.svelte";
  import ZoneBodyGroup from "./zone/ZoneBodyGroup.svelte";
  import ZoneBodyDelete from "./zone/ZoneBodyDelete.svelte";
  import ZoneBodyHidden from "./zone/ZoneBodyHidden.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  createPreviewsContext();
  const operations = createOperationsContext();
  createQueryContext();
  createSelectionContext();
  const board = createBoardContext();
  createDragContext();
  const review = createReviewContext();

  beforeNavigate(board.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={board.handleBeforeUnload} />

<svelte:head>
  <title>Tags</title>
</svelte:head>

{#snippet aside()}
  <aside>
    <ZoneContainer
      target={{ kind: "new-group" }}
      aria-label="新合併區"
      style="align-items: center; padding: 1rem 0.75rem;"
    >
      <ZoneBodyCreate />
    </ZoneContainer>

    {#each board.groups as group (group.id)}
      <ZoneContainer target={{ kind: "group", id: group.id }} aria-label={`合併區 ${group.canonical.trim()}`}>
        <ZoneHeader target={{ kind: "group", id: group.id }} label="合併或重新命名" />
        <ZoneBodyGroup {group} />
      </ZoneContainer>
    {/each}

    <ZoneContainer target={{ kind: "delete" }} aria-label="刪除區">
      <ZoneHeader target={{ kind: "delete" }} label="刪除區" />
      <ZoneBodyDelete />
    </ZoneContainer>

    <ZoneContainer target={{ kind: "hidden" }} aria-label="切換隱藏區">
      <ZoneHeader target={{ kind: "hidden" }} label="切換隱藏區" />
      <ZoneBodyHidden />
    </ZoneContainer>
  </aside>
{/snippet}

<div class="container">
  <Toolbar>
    <Filters />
    <RefreshButton pending={operations.pending} onrefresh={operations.handleRefresh} style="margin-left: auto;" />
    <CleanLink />
    <ReviewTrigger
      count={board.touchedCount}
      disabled={board.touchedCount === 0 || operations.pending}
      onclick={review.handleOpen}
    />
  </Toolbar>

  <div>
    <Pool />
    {@render aside()}
  </div>
</div>

<ReviewModal />

<style>
  div.container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  div.container > div {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  aside {
    width: 23rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem;
    border-left: var(--border-style);
    background: var(--color-bg-card);

    @media (max-width: 600px) {
      width: 16rem;
    }
  }
</style>
