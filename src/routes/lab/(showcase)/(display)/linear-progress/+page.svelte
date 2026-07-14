<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  let value = $state(40);

  const total = 657;
  const readyCount = 12;
  const blockedCount = 3;
  const touchedCount = readyCount + blockedCount;
  const untouchedCount = total - touchedCount;
</script>

{#snippet statDetail()}
  <div class="tooltip">
    <p class="tooltip-title">本次工作階段進度</p>
    <dl>
      <div class="row">
        <dt>暫存區總數</dt>
        <dd>{total} 張</dd>
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
    <p class="tooltip-note">
      進度條顯示「已填寫暫存」佔總數的比例（無論是否可提交）。無法提交的原因可見卡片上的標記，或於「檢視變更並提交」中逐張查看。
    </p>
  </div>
{/snippet}

<svelte:head>
  <title>LinearProgress</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <h4>Determinate</h4>
      <div class="demo-row">
        <!-- TODO: 若未來有開發 RangeInput，應該替換這裡 -->
        <input type="range" min="0" max="100" bind:value />
        <span class="value">{value}%</span>
      </div>
      <div class="stack">
        <LinearProgress {value} size="md" color="var(--color-accent)" />
        <LinearProgress {value} size="sm" color="var(--color-accent)" />
      </div>

      <h4>Indeterminate</h4>
      <div class="stack">
        <LinearProgress size="md" color="var(--color-accent)" />
        <LinearProgress size="sm" color="var(--color-accent)" />
      </div>

      <h4>Stat readout with tooltip detail</h4>
      <div
        class="stat"
        role="status"
        aria-label={`已填寫 ${touchedCount} / ${total} 張`}
        {@attach tooltip({ content: statDetail, placement: "bottom" })}
      >
        <LinearProgress value={(touchedCount / total) * 100} size="md" color="var(--color-text)" style="width: 9rem;" />
        <span class="count">{touchedCount} / {total} 張</span>
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="LinearProgress"
  label="Determinate, indeterminate, and a real stat readout"
  guide="A single `value` prop switches between determinate and indeterminate — undefined means _still running, no known percentage_, not _zero_. The last row hovers to a tooltip breakdown, the same pairing `tagger-b`'s session progress hand-rolled its own fixed-position tooltip for; here it's just the existing `Tooltip` attachment."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 26rem;
  }

  h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);

    &:not(:first-child) {
      margin-top: 0.5rem;
    }
  }

  .demo-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .demo-row input {
    flex: 1;
  }

  .value {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
    width: 3ch;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

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
