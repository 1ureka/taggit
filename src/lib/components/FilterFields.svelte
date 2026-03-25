<script lang="ts">
  import Autocomplete from "./Autocomplete.svelte";
  import Select from "./Select.svelte";

  let {
    search = $bindable(""),
    includedTags = $bindable([]),
    excludedTags = $bindable([]),
    rating = $bindable(undefined),
    ratingOp = $bindable("gte"),
    sort = $bindable("committedAt"),
    order = $bindable("desc"),
  }: {
    search?: string;
    includedTags?: string[];
    excludedTags?: string[];
    rating?: number | undefined;
    ratingOp?: "gte" | "lte" | "eq";
    sort?: string;
    order?: string;
  } = $props();

  const ratingOpOptions = [
    { value: "gte", label: "≥" },
    { value: "lte", label: "≤" },
    { value: "eq", label: "=" },
  ];

  const ratingOptions = [
    { value: undefined, label: "全部" },
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 4, label: "4" },
    { value: 5, label: "5" },
  ];

  const sortOptions = [
    { value: "committedAt", label: "時間" },
    { value: "rating", label: "評分" },
    { value: "name", label: "名稱" },
    { value: "random", label: "隨機" },
  ];

  const orderOptions = [
    { value: "desc", label: "降冪" },
    { value: "asc", label: "升冪" },
  ];
</script>

<div class="filter-fields">
  <div class="field-row">
    <label class="field-label" for="filter-search">名稱</label>
    <input id="filter-search" class="text-input" type="text" placeholder="搜尋名稱..." bind:value={search} />
  </div>

  <div class="field-row">
    <span class="field-label">包含的標籤</span>
    <Autocomplete bind:tags={includedTags} variant="inline" placeholder="包含標籤..." />
  </div>

  <div class="field-row">
    <span class="field-label">排除的標籤</span>
    <Autocomplete bind:tags={excludedTags} variant="inline" placeholder="排除標籤..." />
  </div>

  <div class="field-row">
    <span class="field-label">評等</span>
    <div class="field-inline">
      <Select bind:value={ratingOp} options={ratingOpOptions} size="md" stretch />
      <Select bind:value={rating} options={ratingOptions} size="md" stretch />
    </div>
  </div>

  <div class="field-row">
    <span class="field-label">排序</span>
    <div class="field-inline">
      <Select bind:value={sort} options={sortOptions} size="md" stretch />
      <Select bind:value={order} options={orderOptions} size="md" stretch />
    </div>
  </div>
</div>

<style>
  .filter-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .field-row {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  .field-inline {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
</style>
