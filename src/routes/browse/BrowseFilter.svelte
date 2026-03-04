<script lang="ts">
  import { IconPlayerPlay, IconArrowLeft } from "@tabler/icons-svelte";
  import TagChips from "$lib/components/TagChips.svelte";
  import TagAutocomplete from "$lib/components/TagAutocomplete.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Select from "$lib/components/Select.svelte";

  import { filterStore } from "./stores.svelte.js";
  import { addTag, removeTag, updateCount, setSort, startPlayer } from "./actions.js";

  let startDisabled = $derived(filterStore.matchCount === 0 || filterStore.counting);
  let countText = $derived(filterStore.counting ? "查詢中..." : `共 ${filterStore.matchCount} 張符合`);

  // Rating uses bind:value for two-way toggle; trigger count on change
  let prevRating = filterStore.minRating;
  $effect(() => {
    const cur = filterStore.minRating;
    if (cur !== prevRating) {
      prevRating = cur;
      updateCount();
    }
  });

  const sortOptions = [
    { value: "committedAt", label: "提交時間" },
    { value: "rating", label: "評等" },
    { value: "originalName", label: "檔名" },
    { value: "random", label: "隨機" },
  ];

  function handleSortChange() {
    setSort(filterStore.sort as "committedAt" | "rating" | "originalName" | "random");
  }
</script>

<div class="browse-filter">
  <div class="browse-filter-box">
    <h2>水平瀏覽</h2>

    <!-- Tag Filter -->
    <div class="browse-filter-field">
      <span class="browse-filter-label">標籤篩選</span>
      {#if filterStore.tags.length > 0}
        <TagChips tags={filterStore.tags} onremove={removeTag} />
      {/if}
      <TagAutocomplete
        allTags={filterStore.allTags}
        excludedTags={filterStore.tags}
        placeholder="添加標籤..."
        onselect={addTag}
      />
    </div>

    <!-- Min Rating -->
    <div class="browse-filter-field">
      <span class="browse-filter-label">最低評等</span>
      <Rating bind:value={filterStore.minRating} size="1.5rem" />
    </div>

    <!-- Sort -->
    <div class="browse-filter-field">
      <span class="browse-filter-label">排序</span>
      <Select bind:value={filterStore.sort} options={sortOptions} size="md" stretch onchange={handleSortChange} />
    </div>

    <!-- Count -->
    <div class="browse-filter-count">{countText}</div>

    <!-- Start Button -->
    <button class="btn btn-primary" style="width:100%" disabled={startDisabled} onclick={startPlayer}>
      <IconPlayerPlay size={18} />
      {#if filterStore.counting}
        查詢中...
      {:else}
        開始瀏覽
      {/if}
    </button>

    <!-- Back to Home -->
    <a href="/" class="btn btn-ghost btn-sm" style="margin-top:0.5rem;width:100%;text-align:center;">
      <IconArrowLeft size={16} />
      返回首頁
    </a>
  </div>
</div>

<style>
  @import "./BrowseFilter.css";
</style>
