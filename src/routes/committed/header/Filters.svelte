<script lang="ts">
  import { IMAGE_SORTS } from "$lib/query-spec";
  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/components/widgets/SearchInput.svelte";

  import FilterPopover from "./FilterPopover.svelte";
  import FilterButton from "./FilterButton.svelte";
  import { getQueryContext } from "../logic2/query.svelte";

  const query = getQueryContext();

  const id = $props.id();
  let menuOpen = $state(false);
  let menuAnchor = $state<HTMLElement>();

  const sortOptions = [...IMAGE_SORTS];
  const sortLabels: Record<string, string> = { committedAt: "時間", rating: "評分", name: "名稱", random: "隨機" };
  const orderOptions = ["desc", "asc"] as const;
  const orderLabels: Record<string, string> = { desc: "降冪", asc: "升冪" };

  const handleToggleMenu = () => {
    menuOpen = !menuOpen;
  };

  const handleCloseMenu = () => {
    menuOpen = false;
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
      value={query.query.where.search}
      onsearch={query.handleSearch}
    />
  </div>

  <Select
    id="{id}-sort"
    aria-label="排序欄位"
    options={sortOptions}
    option={sortOption}
    value={query.query.list.sort}
    onchange={query.handleSortChange}
  />
  <Select
    id="{id}-order"
    aria-label="排序方向"
    options={orderOptions}
    option={orderOption}
    value={query.query.list.order}
    onchange={query.handleOrderChange}
    status={query.query.list.sort === "random" ? "disabled" : "default"}
  />

  <span bind:this={menuAnchor}>
    <FilterButton aria-expanded={menuOpen} onclick={handleToggleMenu} />
  </span>

  <FilterPopover open={menuOpen} reference={menuAnchor} onclose={handleCloseMenu} />
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
