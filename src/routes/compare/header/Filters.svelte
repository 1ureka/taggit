<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { ImageQuery, IMAGE_SORTS } from "$lib/query-spec";

  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/widgets/SearchInput.svelte";
  import FilterPopover from "./FilterPopover.svelte";
  import FilterButton from "./FilterButton.svelte";

  const id = $props.id();

  let query = $derived(ImageQuery.fromSearchParams(page.url.searchParams));
  let menuOpen = $state(false);
  let menuAnchor = $state<HTMLElement>();

  const sortOptions = [...IMAGE_SORTS];
  const sortLabels: Record<string, string> = { committedAt: "時間", rating: "評分", name: "名稱", random: "隨機" };
  const orderOptions = ["desc", "asc"] as const;
  const orderLabels: Record<string, string> = { desc: "降冪", asc: "升冪" };

  // ---

  const handleQuery = (query: ImageQuery) => {
    const qs = query.toSearchParams(new URLSearchParams(location.search)).toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };

  const handleToggleMenu = () => {
    menuOpen = !menuOpen;
  };

  const handleCloseMenu = () => {
    menuOpen = false;
  };

  const handleSearch = (search: string) => {
    handleQuery(new ImageQuery(query.where.with({ search }), query.list));
  };

  const handleSortChange = (key: string) => {
    if (key === "committedAt" || key === "rating" || key === "name" || key === "random") {
      handleQuery(new ImageQuery(query.where, query.list.with({ sort: key })));
    }
  };

  const handleOrderChange = (key: string) => {
    if (key === "desc" || key === "asc") {
      handleQuery(new ImageQuery(query.where, query.list.with({ order: key })));
    }
  };

  const handleFilterChange = (query: ImageQuery) => {
    handleQuery(query);
  };
</script>

{#snippet sortOption(key: string)}{sortLabels[key] ?? key}{/snippet}
{#snippet orderOption(key: string)}{orderLabels[key] ?? key}{/snippet}

<div class="filters">
  <div class="search">
    <SearchInput
      label="搜尋名稱"
      labelHidden
      placeholder="搜尋名稱…"
      value={query.where.search}
      onsearch={handleSearch}
    />
  </div>

  <Select
    id="{id}-sort"
    aria-label="排序欄位"
    options={sortOptions}
    option={sortOption}
    value={query.list.sort}
    onchange={handleSortChange}
  />
  <Select
    id="{id}-order"
    aria-label="排序方向"
    options={orderOptions}
    option={orderOption}
    value={query.list.order}
    onchange={handleOrderChange}
    status={query.list.sort === "random" ? "disabled" : "default"}
  />

  <span bind:this={menuAnchor}>
    <FilterButton aria-expanded={menuOpen} onclick={handleToggleMenu} />
  </span>

  <FilterPopover
    open={menuOpen}
    reference={menuAnchor}
    {query}
    onchange={handleFilterChange}
    onclose={handleCloseMenu}
  />
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
