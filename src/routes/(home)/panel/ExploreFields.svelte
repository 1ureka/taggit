<script lang="ts">
  import { IMAGE_SORTS } from "$lib/query-spec";
  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/widgets/SearchInput.svelte";
  import TagInput from "$lib/widgets/TagInput.svelte";
  import { getFilterContext } from "../logic/filter.svelte";

  const filter = getFilterContext();
  const id = $props.id();

  const ratingOptions = ["all", "1", "2", "3", "4", "5"];
  const ratingOpOptions = ["gte", "lte", "eq"] as const;
  const ratingOpLabels: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

  const sortOptions = [...IMAGE_SORTS];
  const sortLabels: Record<string, string> = { committedAt: "時間", rating: "評分", name: "名稱", random: "隨機" };

  const orderOptions = ["desc", "asc"] as const;
  const orderLabels: Record<string, string> = { desc: "降冪", asc: "升冪" };
</script>

{#snippet ratingOpOption(key: string)}{ratingOpLabels[key] ?? key}{/snippet}
{#snippet ratingOption(key: string)}{key === "all" ? "全部" : key}{/snippet}
{#snippet sortOption(key: string)}{sortLabels[key] ?? key}{/snippet}
{#snippet orderOption(key: string)}{orderLabels[key] ?? key}{/snippet}

<div class="fields">
  <div class="field">
    <span class="field-label">名稱</span>
    <SearchInput
      label="搜尋名稱"
      labelHidden
      placeholder="搜尋名稱…"
      value={filter.query.where.search}
      onsearch={filter.handleSearch}
    />
  </div>

  <div class="field">
    <TagInput
      tags={filter.query.where.includedTags}
      scope={filter.facetScope}
      label="包含的標籤"
      onchange={(tags) => filter.handleTagsChange("includedTags", tags)}
    />
  </div>

  <div class="field">
    <TagInput
      tags={filter.query.where.excludedTags}
      scope={filter.facetScope}
      label="排除的標籤"
      onchange={(tags) => filter.handleTagsChange("excludedTags", tags)}
    />
  </div>

  <div class="field">
    <span class="field-label">評等</span>
    <div class="field-pair">
      <Select
        id="{id}-rating-op"
        aria-label="評等比較運算"
        options={ratingOpOptions}
        option={ratingOpOption}
        value={filter.query.where.ratingOp}
        onchange={filter.handleRatingOpChange}
      />
      <Select
        id="{id}-rating"
        aria-label="評等"
        options={ratingOptions}
        option={ratingOption}
        value={filter.query.where.rating ? String(filter.query.where.rating) : "all"}
        onchange={filter.handleRatingChange}
      />
    </div>
  </div>

  <div class="field">
    <span class="field-label">排序</span>
    <div class="field-pair">
      <Select
        id="{id}-sort"
        aria-label="排序欄位"
        options={sortOptions}
        option={sortOption}
        value={filter.query.list.sort}
        onchange={filter.handleSortChange}
      />
      <Select
        id="{id}-order"
        aria-label="排序方向"
        options={orderOptions}
        option={orderOption}
        value={filter.query.list.order}
        onchange={filter.handleOrderChange}
        status={filter.query.list.sort === "random" ? "disabled" : "default"}
      />
    </div>
  </div>
</div>

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border-bottom: var(--border-style);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font: var(--font-body2);
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .field-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: stretch;
    gap: 0.5rem;
  }
</style>
