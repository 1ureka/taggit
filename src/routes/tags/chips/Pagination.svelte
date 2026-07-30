<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { IconChevronDown, IconChevronRightPipe } from "$lib/icons";
  import { getQueryContext } from "../logic/query.svelte";

  const query = getQueryContext();

  const backward = $derived(query.atFirst ? "disabled" : undefined);
  const forward = $derived(query.atLast ? "disabled" : undefined);
</script>

<div>
  <Button variant="ghost" padding="icon" aria-label="第一頁" status={backward} onclick={query.handleFirstPage}>
    <IconChevronRightPipe size={16} style="transform: rotate(180deg);" />
  </Button>
  <Button variant="ghost" padding="icon" aria-label="上一頁" status={backward} onclick={query.handlePrevPage}>
    <IconChevronDown size={16} style="transform: rotate(90deg);" />
  </Button>

  <span>第 {query.page} / {query.pages} 頁 · 共 {query.total} 個</span>

  <Button variant="ghost" padding="icon" aria-label="下一頁" status={forward} onclick={query.handleNextPage}>
    <IconChevronDown size={16} style="transform: rotate(-90deg);" />
  </Button>
  <Button variant="ghost" padding="icon" aria-label="最後一頁" status={forward} onclick={query.handleLastPage}>
    <IconChevronRightPipe size={16} />
  </Button>
</div>

<style>
  div {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    border-top: var(--border-style);
  }

  span {
    margin: 0 0.5rem;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
