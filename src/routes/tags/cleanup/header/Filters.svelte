<script lang="ts">
  import { getFilterContext, KIND_LABELS, type Tab } from "../logic/filter.svelte";

  const filter = getFilterContext();

  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "similar", label: KIND_LABELS.similar },
    { value: "cooccur", label: KIND_LABELS.cooccur },
    { value: "rare", label: KIND_LABELS.rare },
    { value: "unused", label: KIND_LABELS.unused },
  ];
</script>

<div class="tabs">
  {#each tabs as t (t.value)}
    <button type="button" class:active={filter.tab === t.value} onclick={() => filter.handleTabChange(t.value)}>
      <span>{t.label}</span>
      <span class="count">{t.value === "all" ? filter.total : (filter.kindCounts.get(t.value) ?? 0)}</span>
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    overflow-x: auto;
  }

  button {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    white-space: nowrap;
    border-radius: 9999px;

    &:hover {
      background: var(--color-bg-hover);
    }

    &.active {
      background: var(--color-bg-active);
      color: var(--color-text);
    }
  }

  .count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    opacity: 0.7;
  }
</style>
