<script lang="ts">
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconArrowLeft } from "$lib/icons";
  import { getQueryContext, KIND_LABELS, type Tab } from "../logic/query.svelte";

  const query = getQueryContext();

  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "similar", label: KIND_LABELS.similar },
    { value: "cooccur", label: KIND_LABELS.cooccur },
    { value: "rare", label: KIND_LABELS.rare },
    { value: "unused", label: KIND_LABELS.unused },
  ];
</script>

<div class="tabs">
  <ButtonLink
    variant="ghost"
    padding="icon"
    href="/tags"
    aria-label="返回標籤管理"
    {@attach tooltip({ content: "返回標籤管理" })}
  >
    <IconArrowLeft size={16} />
  </ButtonLink>

  {#each tabs as t (t.value)}
    <button type="button" class:active={query.tab === t.value} onclick={() => query.handleTabChange(t.value)}>
      <span>{t.label}</span>
      <span class="count">{t.value === "all" ? query.total : (query.kindCounts.get(t.value) ?? 0)}</span>
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
    white-space: nowrap;
    border-radius: 9999px;
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }
  }

  button {
    color: var(--color-text-muted);
    background-color: transparent;

    &:hover {
      color: var(--color-text);
      background-color: var(--color-bg-hover);
    }
  }

  button.active {
    color: hsl(from var(--color-accent) h s l / 0.85);
    background-color: hsl(from var(--color-accent) h s l / 0.15);

    &:hover {
      color: var(--color-accent);
      background-color: hsl(from var(--color-accent) h s l / 0.25);
    }
  }

  .count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    opacity: 0.7;
  }
</style>
