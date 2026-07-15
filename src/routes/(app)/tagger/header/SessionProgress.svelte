<script lang="ts">
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  type Props = {
    /** 暫存區圖片總數 */
    fileCount: number;
    /** 有暫存內容的圖片數（無論是否可提交） */
    touchedCount: number;
    /** 可提交的圖片數 */
    readyCount: number;
  };

  let { fileCount, touchedCount, readyCount }: Props = $props();

  const blockedCount = $derived(touchedCount - readyCount);
  const untouchedCount = $derived(fileCount - touchedCount);
  const ratio = $derived(fileCount > 0 ? (touchedCount / fileCount) * 100 : 0);
</script>

{#snippet statDetail()}
  <div class="tooltip">
    <p class="tooltip-title">本次工作階段進度</p>
    <dl>
      <div class="row">
        <dt>暫存區總數</dt>
        <dd>{fileCount} 張</dd>
      </div>
      <div class="row">
        <dt>已填寫暫存</dt>
        <dd>{touchedCount} 張</dd>
      </div>
      <div class="row sub">
        <dt>其中可提交</dt>
        <dd class="ok">{readyCount} 張</dd>
      </div>
      <div class="row sub">
        <dt>其中尚無法提交</dt>
        <dd class:warn={blockedCount > 0}>{blockedCount} 張</dd>
      </div>
      <div class="row">
        <dt>尚未編輯</dt>
        <dd>{untouchedCount} 張</dd>
      </div>
    </dl>
    <p class="tooltip-note">無法提交的原因可見卡片上的標記，或於「檢視變更並提交」中逐張查看。</p>
  </div>
{/snippet}

<div
  class="stat"
  role="status"
  aria-label={`已填寫 ${touchedCount} / ${fileCount} 張`}
  {@attach tooltip({ content: statDetail, placement: "bottom" })}
>
  <LinearProgress value={ratio} size="md" color="var(--color-text)" style="width: 9rem;" />
  <span class="count">{touchedCount} / {fileCount} 張</span>
</div>

<style>
  .stat {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    width: max-content;
    padding: 0.375rem 0.25rem;
    cursor: help;
  }

  .count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  /* --- */

  .tooltip {
    width: max-content;
    max-width: 19rem;
    padding: 0.625rem 0.75rem;
  }

  .tooltip-title {
    font: var(--font-body1);
    margin-bottom: 0.375rem;
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin-bottom: 0.5rem;
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1.25rem;
    font: var(--font-caption);

    &.sub {
      padding-left: 0.75rem;
    }
    & > dt {
      opacity: 0.75;
    }

    & > dd {
      font-family: var(--font-family-mono);
    }
    & > dd.ok {
      color: var(--color-success);
    }
    & > dd.warn {
      color: var(--color-warning);
    }
  }

  .tooltip-note {
    font: var(--font-caption);
    opacity: 0.75;
    line-height: 1.5;
  }
</style>
