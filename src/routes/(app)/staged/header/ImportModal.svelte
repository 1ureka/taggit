<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import ImportGuide from "./ImportGuide.svelte";
  import type { ImportProgress, ImportResult } from "./import";

  type Props = {
    /** 是否開啟匯入對話框 */
    open: boolean;
    /** 是否正在匯入中 */
    pending: boolean;
    /** 匯入中的即時進度，尚未開始或已結束時為 null */
    progress: ImportProgress | null;
    /** 上一次匯入完成後的結果摘要，尚未匯入或已重置時為 null */
    result: ImportResult | null;
    /** 關閉對話框事件 */
    onclose: () => void;
    /** 選擇檔案事件 */
    onimport: (file: File) => void;
  };

  let { open, pending, progress, result, onclose, onimport }: Props = $props();

  const percent = $derived(progress && progress.total > 0 ? (progress.current / progress.total) * 100 : undefined);
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
    <Button variant="primary" onclick={onclose}>關閉</Button>
  </div>
{/snippet}

{#snippet progressDisplay({ current, total }: ImportProgress)}
  <p class="desc">匯入中 {current}/{total}</p>

  <LinearProgress value={percent} size="md" color="var(--color-accent)" />
{/snippet}

<Modal {open} {onclose} aria-label="匯入紀錄">
  <div class="body">
    <h3>匯入紀錄</h3>

    {#if result}
      {@render resultDisplay(result)}
    {:else if pending}
      {@render progressDisplay(progress ?? { current: 0, total: 0 })}
    {:else}
      <ImportGuide {onimport} {onclose} />
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
