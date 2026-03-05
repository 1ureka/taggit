<script lang="ts">
  import { IconPlayerPlay, IconArrowLeft } from "@tabler/icons-svelte";
  import TagAutocompleteNew from "$lib/components/TagAutocompleteNew.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Select from "$lib/components/Select.svelte";

  import { filterStore } from "./stores.svelte.js";
  import { updateCount, startPlayer } from "./actions.js";

  let startDisabled = $derived(filterStore.matchCount === 0 || filterStore.counting);
  let countText = $derived(filterStore.counting ? "查詢中..." : `共 ${filterStore.matchCount} 張符合`);

  const sortOptions = [
    { value: "committedAt", label: "提交時間" },
    { value: "rating", label: "評等" },
    { value: "originalName", label: "檔名" },
    { value: "random", label: "隨機" },
  ];
</script>

<div class="browse-filter">
  <div class="browse-filter-box">
    <h2>水平瀏覽</h2>

    <!-- Tag Filter -->
    <div class="browse-filter-field">
      <span class="browse-filter-label">標籤篩選</span>
      <TagAutocompleteNew bind:tags={filterStore.tags} variant="top" placeholder="添加標籤..." onchange={updateCount} />
    </div>

    <!-- Min Rating -->
    <div class="browse-filter-field">
      <span class="browse-filter-label">最低評等</span>
      <Rating bind:value={filterStore.minRating} size="1.5rem" onchange={updateCount} />
    </div>

    <!-- Sort -->
    <div class="browse-filter-field">
      <span class="browse-filter-label">排序</span>
      <Select bind:value={filterStore.sort} options={sortOptions} size="md" stretch />
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
  .browse-filter {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
  }

  .browse-filter-box {
    width: 100%;
    max-width: 480px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2rem;
  }

  .browse-filter-box h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .browse-filter-field {
    margin-bottom: 1rem;
  }

  .browse-filter-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 0.375rem;
  }

  .browse-filter-count {
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }
</style>
