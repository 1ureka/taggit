<script lang="ts">
  import type { TagInfo } from "$lib/types.js";
  import TagAutocomplete from "./TagAutocomplete.svelte";
  import Select from "./Select.svelte";

  let {
    allTags = [],
    selectedTags = $bindable([]),
    rating = $bindable(undefined),
    ratingOp = $bindable("gte"),
    sort = $bindable("committedAt"),
    order = $bindable("desc"),
    onchange,
  }: {
    allTags?: TagInfo[];
    selectedTags?: string[];
    rating?: number | undefined;
    ratingOp?: "gte" | "lte" | "eq";
    sort?: string;
    order?: string;
    onchange?: () => void;
  } = $props();

  function addTag(tag: string) {
    if (!selectedTags.includes(tag)) {
      selectedTags = [...selectedTags, tag];
      onchange?.();
    }
  }

  function removeTag(tag: string) {
    selectedTags = selectedTags.filter((t) => t !== tag);
    onchange?.();
  }

  function removeLastTag() {
    if (selectedTags.length > 0) {
      selectedTags = selectedTags.slice(0, -1);
      onchange?.();
    }
  }

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
    { value: "originalName", label: "檔名" },
    { value: "random", label: "隨機" },
  ];

  const orderOptions = [
    { value: "desc", label: "降冪" },
    { value: "asc", label: "升冪" },
  ];
</script>

<div class="filter-bar">
  <div class="filter-tags-row">
    {#each selectedTags as tag}
      <button type="button" class="chip chip-removable" onclick={() => removeTag(tag)}>
        {tag}
        <span class="chip-remove">×</span>
      </button>
    {/each}
    <TagAutocomplete
      {allTags}
      excludedTags={selectedTags}
      placeholder="篩選標籤..."
      onselect={addTag}
      onbackspace={removeLastTag}
    />
  </div>
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

  .filter-tags-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
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
