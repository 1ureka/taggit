<script lang="ts">
  import { IconDatabase } from "$lib/icons";
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import ImportGuide from "./ImportGuide.svelte";

  import { getImportContext } from "../logic/import.svelte";

  const importer = getImportContext();
</script>

<Button variant="outlined" status={importer.pending ? "disabled" : undefined} onclick={importer.handleOpen}>
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
    {:else if importer.pending}
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

  div.container > ul {
    font: var(--font-body2);
    color: var(--color-error);
    max-height: 15rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius);
    border: var(--border-style);
    border-color: hsl(from var(--color-error) h s l / 0.75);
    background-color: color-mix(var(--color-error) 10%, var(--color-bg-popover));
    margin-bottom: 1rem;

    & > li {
      list-style: none;
      display: flex;
      align-items: center;
      height: 2rem;
      content-visibility: auto;
      contain-intrinsic-size: auto 2rem;
    }
  }

  div.container > div {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
