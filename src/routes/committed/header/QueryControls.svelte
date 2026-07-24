<script lang="ts">
  import SearchInput from "$lib/components/widgets/SearchInput.svelte";
  import ImageFilters from "$lib/components/toolbar/ImageFilters.svelte";
  import ImageListOptions from "$lib/components/toolbar/ImageListOptions.svelte";
  import { getQueryContext } from "../logic/query.svelte";

  const query = getQueryContext();
</script>

<div class="container">
  <div style="width: clamp(8rem, 24vw, 16rem)">
    <SearchInput
      label="搜尋名稱"
      labelHidden
      placeholder="搜尋名稱…"
      value={query.query.where.search}
      onsearch={query.handleSearch}
    />
  </div>

  <ImageListOptions
    list={query.query.list}
    onchangesort={query.handleSortChange}
    onchangeorder={query.handleOrderChange}
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
  div.container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
