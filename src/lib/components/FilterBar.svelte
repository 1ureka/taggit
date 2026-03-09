<script lang="ts">
  import Autocomplete from "./Autocomplete.svelte";
  import Select from "./Select.svelte";

  let {
    selectedTags = $bindable([]),
    rating = $bindable(undefined),
    ratingOp = $bindable("gte"),
    sort = $bindable("committedAt"),
    order = $bindable("desc"),
    onchange,
  }: {
    selectedTags?: string[];
    rating?: number | undefined;
    ratingOp?: "gte" | "lte" | "eq";
    sort?: string;
    order?: string;
    onchange?: () => void;
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

<div class="filter-bar">
  <Autocomplete bind:tags={selectedTags} variant="inline" placeholder="篩選標籤..." {onchange} />
  <div class="filter-controls">
    <span class="filter-label">評分</span>
    <Select bind:value={ratingOp} options={ratingOpOptions} stretch onchange={() => onchange?.()} />
    <Select bind:value={rating} options={ratingOptions} stretch onchange={() => onchange?.()} />
    <span class="filter-label">排序</span>
    <Select bind:value={sort} options={sortOptions} stretch onchange={() => onchange?.()} />
    <Select bind:value={order} options={orderOptions} stretch onchange={() => onchange?.()} />
  </div>
</div>

<style>
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-controls {
    display: grid;
    grid-template-columns: auto 1fr 1fr auto 1fr 1fr;
    gap: 0.375rem 0.5rem;
    align-items: center;
    font-size: 0.8125rem;
  }

  .filter-label {
    color: var(--text-muted);
    white-space: nowrap;
  }
</style>
