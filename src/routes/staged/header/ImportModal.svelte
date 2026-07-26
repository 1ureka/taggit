<script lang="ts">
  import { IconDatabase } from "$lib/icons";
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import ImportGuide from "./ImportGuide.svelte";

  import { getImportContext } from "../logic/import.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  const importer = getImportContext();
  const operations = getOperationsContext();
</script>

<Button variant="outlined" status={operations.pending ? "disabled" : undefined} onclick={importer.handleOpen}>
  <IconDatabase size={16} />
  <span>匯入紀錄</span>
</Button>

<Modal open={importer.open} onclose={importer.handleClose} aria-label="匯入紀錄">
  <div class="container">
    <h3>匯入紀錄</h3>

    {#if importer.result}
      {@const result = importer.result}
      {@const description = `成功匯入 ${result.imported} 筆${result.skipped > 0 ? `，跳過 ${result.skipped} 筆` : ""}`}

      <p class="summary">{description}</p>
      {#if result.errors.length > 0}
        <ul class="errors">
          {#each result.errors as err}<li>{err}</li>{/each}
        </ul>
      {/if}
      <div>
        <Button variant="primary" onclick={importer.handleClose}>關閉</Button>
      </div>
    {:else if operations.pending}
      {@const progress = importer.progress ?? { current: 0, total: 0 }}
      {@const current = progress.current}
      {@const total = progress.total}
      {@const percent = total > 0 ? (current / total) * 100 : undefined}

      <p>匯入中 {current}/{total}</p>
      <LinearProgress value={percent} size="md" color="var(--color-accent)" />
    {:else}
      <ImportGuide />
    {/if}
  </div>
</Modal>

<style>
  div.container {
    width: 26rem;
    max-width: min(90dvw, 26rem);
    padding: 1.25rem;
  }

  div.container > h3 {
    font: var(--font-title1);
    margin-bottom: 0.75rem;
  }

  div.container > p {
    font: var(--font-body2);
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;

    &.summary {
      font: var(--font-body1);
      color: var(--color-text);
    }
  }

  /* TODO: 設計的好看一點 */
  div.container > ul {
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

  div.container > div {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
