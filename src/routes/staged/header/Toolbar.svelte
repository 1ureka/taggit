<script lang="ts">
  import { IconDatabase } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import RefreshButton from "$lib/components/widgets/RefreshButton.svelte";
  import SessionProgress from "./SessionProgress.svelte";

  import { getOperationsContext } from "../logic/operations.svelte";
  import { getEditorContext } from "../logic/editor.svelte";
  import { getReviewContext } from "../logic/review.svelte";
  import { getImportContext } from "../logic/import.svelte";

  const operations = getOperationsContext();
  const editor = getEditorContext();
  const review = getReviewContext();
  const importer = getImportContext();

  const touchedCount = $derived(editor.touchedFiles.length);
</script>

<div class="container">
  <SessionProgress />

  <div>
    <RefreshButton pending={operations.pending} onrefresh={operations.handleRefresh} />

    <Button variant="outlined" status={operations.pending ? "disabled" : undefined} onclick={importer.handleOpen}>
      <IconDatabase size={16} />
      <span>匯入紀錄</span>
    </Button>

    <ReviewTrigger
      count={touchedCount}
      disabled={operations.pending || touchedCount === 0}
      onclick={review.handleOpen}
    />
  </div>
</div>

<style>
  div.container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0px 1rem;
    height: 3rem;
    border-bottom: var(--border-style);
  }

  div.container > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
