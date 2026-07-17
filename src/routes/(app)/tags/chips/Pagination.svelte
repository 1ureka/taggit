<script lang="ts">
  import { page, navigating } from "$app/state";
  import { goto } from "$app/navigation";
  import { TagQuery } from "$lib/query-spec";
  import Button from "$lib/components/actions/Button.svelte";

  let { total }: { total: number } = $props();

  const query = $derived(TagQuery.fromSearchParams(page.url.searchParams));
  const currentPage = $derived(query.list.page);
  const totalPages = $derived(Math.max(1, Math.ceil(total / 100)));

  const disabledPrev = $derived(navigating || currentPage <= 1);
  const disabledNext = $derived(navigating || currentPage >= totalPages);

  const gotoPage = (p: number) => {
    const q = query.with({ list: query.list.with({ page: p }) });
    const qs = q.toSearchParams(new URLSearchParams(location.search)).toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };

  const handlePrev = () => {
    if (!disabledPrev) gotoPage(currentPage - 1);
  };

  const handleNext = () => {
    if (!disabledNext) gotoPage(currentPage + 1);
  };
</script>

<div>
  <Button variant="ghost" status={disabledPrev ? "disabled" : undefined} onclick={handlePrev}>上一頁</Button>
  <span>第 {currentPage} / {totalPages} 頁 · 共 {total} 個</span>
  <Button variant="ghost" status={disabledNext ? "disabled" : undefined} onclick={handleNext}>下一頁</Button>
</div>

<style>
  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-top: var(--border-style);
  }

  span {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
