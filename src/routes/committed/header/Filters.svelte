<script lang="ts">
  import { IMAGE_SORTS } from "$lib/query-spec";
  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/components/widgets/SearchInput.svelte";

  import { getQueryContext } from "../logic/query.svelte";
  import ImageFilters from "$lib/components/toolbar/ImageFilters.svelte";

  const query = getQueryContext();

  const id = $props.id();

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

  <ImageFilters
    where={query.query.where}
    scope={query.facetScope}
    onchangetags={query.handleTagsChange}
    onchangerating={query.handleRatingChange}
    onchangeratingop={query.handleRatingOpChange}
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
