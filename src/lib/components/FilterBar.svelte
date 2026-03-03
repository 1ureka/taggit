<script lang="ts">
  import type { TagInfo } from "$lib/types.js";
  import TagAutocomplete from "./TagAutocomplete.svelte";

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
</script>

<div class="filter-bar" style="display:flex;flex-direction:column;gap:0.5rem;">
  <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
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
  <div style="display:flex;gap:0.5rem;align-items:center;font-size:0.8125rem;">
    <label style="display:flex;align-items:center;gap:0.25rem;color:var(--text-muted);">
      評分
      <select
        class="input"
        style="width:auto;padding:0.25rem 0.5rem;"
        bind:value={ratingOp}
        onchange={() => onchange?.()}
      >
        <option value="gte">≥</option>
        <option value="lte">≤</option>
        <option value="eq">=</option>
      </select>
      <select
        class="input"
        style="width:auto;padding:0.25rem 0.5rem;"
        bind:value={rating}
        onchange={() => onchange?.()}
      >
        <option value={undefined}>全部</option>
        {#each [1, 2, 3, 4, 5] as r}
          <option value={r}>{r}</option>
        {/each}
      </select>
    </label>
    <label style="display:flex;align-items:center;gap:0.25rem;color:var(--text-muted);">
      排序
      <select class="input" style="width:auto;padding:0.25rem 0.5rem;" bind:value={sort} onchange={() => onchange?.()}>
        <option value="committedAt">時間</option>
        <option value="rating">評分</option>
        <option value="originalName">檔名</option>
        <option value="random">隨機</option>
      </select>
    </label>
    <label style="display:flex;align-items:center;gap:0.25rem;color:var(--text-muted);">
      <select class="input" style="width:auto;padding:0.25rem 0.5rem;" bind:value={order} onchange={() => onchange?.()}>
        <option value="desc">降冪</option>
        <option value="asc">升冪</option>
      </select>
    </label>
  </div>
</div>
