<script lang="ts">
  import { IconArrowBackUpDouble, IconAlertCircleFilled } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";

  import type { ReviewEntry } from "../logic/review-entry";
  import { getReviewContext } from "../logic/review.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  let { entry }: { entry: ReviewEntry } = $props();

  const review = getReviewContext();
  const operations = getOperationsContext();

  const kindLabel = { merge: "合併", delete: "刪除", hidden: "隱藏" };
</script>

<li class:excluded={!entry.checked}>
  <Checkbox
    checked={entry.checked}
    status={!entry.checkable ? "disabled" : "default"}
    onchange={() => review.handleToggle(entry.name)}
    aria-label={`包含 ${entry.name}`}
  />

  <div class="info">
    <div>
      <span class={{ kind: true, [entry.kind]: true }}>{kindLabel[entry.kind]}</span>
      {#if entry.kind === "merge"}
        <span class="impact">
          <del>{entry.name}</del> → <ins>{entry.to}</ins>
          <span>（{entry.count} 張併入，合併後共 {entry.toCount + entry.count - entry.both} 張）</span>
        </span>
      {:else if entry.kind === "delete"}
        <span class="impact">
          <del>{entry.name}</del>
          <span>（自 {entry.count} 張圖片移除）</span>
        </span>
      {:else}
        <span class="impact">
          {entry.name}
          <span>（{entry.count} 張，查詢時將被遮蔽）</span>
        </span>
      {/if}
    </div>
    {#if entry.problem}
      <span class="problem"><IconAlertCircleFilled size={13} />{entry.problem}</span>
    {/if}
  </div>

  <Button
    variant="ghost"
    padding="icon"
    aria-label={`捨棄 ${entry.name}`}
    status={operations.pending ? "disabled" : undefined}
    {@attach tooltip({ content: "捨棄這筆操作" })}
    onclick={() => review.handleDiscard(entry.name)}
  >
    <IconArrowBackUpDouble size={14} />
  </Button>
</li>

<style>
  li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0px;
  }

  li.excluded > div.info {
    opacity: 0.5;
  }

  div.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  div.info > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  span.kind {
    flex-shrink: 0;
    padding: 0.0625rem 0.4375rem;
    font: var(--font-caption);
    border: var(--border-style);
    color: var(--color-text-muted);
    border-radius: 9999px;
  }

  span.kind.merge {
    color: var(--color-accent);
    border-color: hsl(from var(--color-accent) h s l / 0.5);
    background: hsl(from var(--color-accent) h s l / 0.08);
  }

  span.kind.delete {
    color: var(--color-error);
    border-color: hsl(from var(--color-error) h s l / 0.5);
    background: hsl(from var(--color-error) h s l / 0.08);
  }

  span.kind.hidden {
    color: var(--color-warning);
    border-color: hsl(from var(--color-warning) h s l / 0.5);
    background: hsl(from var(--color-warning) h s l / 0.08);
  }

  span.impact {
    font: var(--font-body2);
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  span.impact > del {
    color: var(--color-text-muted);
    opacity: 0.7;
    text-decoration: line-through;
  }

  span.impact > ins {
    color: var(--color-text);
    text-decoration: none;
  }

  span.impact > span {
    color: var(--color-text-muted);
    font: var(--font-caption);
  }

  span.problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
