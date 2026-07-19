<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import SessionProgress from "./SessionProgress.svelte";
  import { IconDatabase, IconReload } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
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

<div class="toolbar">
  <SessionProgress />

  <div class="actions">
    <Button
      variant="ghost"
      padding="icon"
      aria-label="重新整理"
      status={operations.pending ? "pending" : undefined}
      onclick={operations.handleRefresh}
      {@attach tooltip({ content: "重新整理" })}
    >
      <IconReload size={16} />
    </Button>
    <Button variant="outlined" status={operations.pending ? "disabled" : undefined} onclick={importer.handleOpen}>
      <IconDatabase size={16} />
      <span>匯入紀錄</span>
    </Button>
    <Button
      variant="primary"
      status={operations.pending || touchedCount === 0 ? "disabled" : undefined}
      onclick={review.handleOpen}
    >
      檢視待提交的變更 ({touchedCount})
    </Button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0px 1rem;
    height: 3rem;
    border-bottom: var(--border-style);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
