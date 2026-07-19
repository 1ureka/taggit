<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import ImportGuide from "./ImportGuide.svelte";
  import type { ImportProgress, ImportResult } from "../logic/import-api";
  import { getImportContext } from "../logic/import.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  const importer = getImportContext();
  const operations = getOperationsContext();

  const percent = $derived.by(() => {
    const p = importer.progress;
    return p && p.total > 0 ? (p.current / p.total) * 100 : undefined;
  });
</script>

{#snippet resultDisplay({ imported, skipped, errors }: ImportResult)}
  <p class="summary">
    成功匯入 {imported} 筆{#if skipped > 0}，跳過 {skipped} 筆{/if}
  </p>

  {#if errors.length > 0}
    <ul class="errors">
      {#each errors as err}<li>{err}</li>{/each}
    </ul>
  {/if}

  <div class="actions">
    <Button variant="primary" onclick={importer.handleClose}>關閉</Button>
  </div>
{/snippet}

{#snippet progressDisplay({ current, total }: ImportProgress)}
  <p class="desc">匯入中 {current}/{total}</p>

  <LinearProgress value={percent} size="md" color="var(--color-accent)" />
{/snippet}

<Modal open={importer.open} onclose={importer.handleClose} aria-label="匯入紀錄">
  <div class="body">
    <h3>匯入紀錄</h3>

    {#if importer.result}
      {@render resultDisplay(importer.result)}
    {:else if operations.pending}
      {@render progressDisplay(importer.progress ?? { current: 0, total: 0 })}
    {:else}
      <ImportGuide />
    {/if}
  </div>
</Modal>

<style>
  div.body {
    width: 26rem;
    max-width: min(90dvw, 26rem);
    padding: 1.25rem;
  }

  h3 {
    font: var(--font-title1);
    margin-bottom: 0.75rem;
  }

  p.desc {
    font: var(--font-body2);
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  p.summary {
    font: var(--font-body1);
    margin-bottom: 0.5rem;
  }

  ul.errors {
    font: var(--font-caption);
    color: var(--color-error);
    max-height: 12rem;
    overflow-y: auto;
    padding-left: 0rem;
    margin-bottom: 1rem;

    & > li {
      margin-bottom: 0.5rem;
    }
  }

  div.actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
