<script lang="ts">
  import { page } from "$app/state";
  import { ImageQuery, IMAGE_SORTS } from "$lib/query-spec";

  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/widgets/SearchInput.svelte";
  import FilterPopover from "./FilterPopover.svelte";
  import FilterButton from "./FilterButton.svelte";

  let { onapply }: { onapply: (query: ImageQuery) => void } = $props();

  const id = $props.id();

  let query = $derived(ImageQuery.fromSearchParams(page.url.searchParams));
  let filterOpen = $state(false);
  let filterAnchor = $state<HTMLElement>();

  const apply = () => onapply(new ImageQuery(query.where, query.list));

  const sortOptions = [...IMAGE_SORTS];
  const sortLabels: Record<string, string> = { committedAt: "時間", rating: "評分", name: "名稱", random: "隨機" };

  const orderOptions = ["desc", "asc"] as const;
  const orderLabels: Record<string, string> = { desc: "降冪", asc: "升冪" };
</script>

{#snippet sortOption(key: string)}{sortLabels[key] ?? key}{/snippet}
{#snippet orderOption(key: string)}{orderLabels[key] ?? key}{/snippet}

<div class="filters">
  <div class="search">
    <SearchInput
      bind:value={query.where.search}
      label="搜尋名稱"
      labelHidden
      placeholder="搜尋名稱…"
      onsearch={() => apply()}
    />
  </div>

  <Select
    id="{id}-sort"
    aria-label="排序欄位"
    options={sortOptions}
    option={sortOption}
    bind:value={query.list.sort}
    onchange={() => apply()}
  />
  <Select
    id="{id}-order"
    aria-label="排序方向"
    options={orderOptions}
    option={orderOption}
    bind:value={query.list.order}
    onchange={() => apply()}
    status={query.list.sort === "random" ? "disabled" : "default"}
  />

  <span bind:this={filterAnchor}>
    <FilterButton aria-expanded={filterOpen} onclick={() => (filterOpen = !filterOpen)} />
  </span>

  <FilterPopover bind:open={filterOpen} reference={filterAnchor} bind:query onchange={() => apply()} />
</div>

<style>
  .filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search {
    width: clamp(8rem, 24vw, 16rem);
  }
</style>
