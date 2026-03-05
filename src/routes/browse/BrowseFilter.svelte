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

<div class="browse-container slide-up">
  <a href="/" class="browse-back">
    <IconArrowLeft size={16} />
    返回首頁
  </a>

  <h1 class="browse-title">水平瀏覽</h1>
  <p class="browse-subtitle">設定篩選條件後開始瀏覽</p>

  <!-- Tag Filter -->
  <div class="browse-field">
    <span class="browse-label">標籤篩選</span>
    <TagAutocompleteNew bind:tags={filterStore.tags} variant="top" placeholder="添加標籤..." onchange={updateCount} />
  </div>

  <!-- Min Rating -->
  <div class="browse-field">
    <span class="browse-label">最低評等</span>
    <Rating bind:value={filterStore.minRating} size="1.5rem" onchange={updateCount} />
  </div>

  <!-- Sort -->
  <div class="browse-field">
    <span class="browse-label">排序</span>
    <Select bind:value={filterStore.sort} options={sortOptions} size="md" stretch />
  </div>

  <!-- Count -->
  <div class="browse-count">{countText}</div>

  <!-- Start Button -->
  <button class="btn btn-primary" style="width:100%" disabled={startDisabled} onclick={startPlayer}>
    <IconPlayerPlay size={18} />
    {#if filterStore.counting}
      查詢中...
    {:else}
      開始瀏覽
    {/if}
  </button>
</div>

<style>
  .browse-container {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .browse-back {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-dim);
    font-size: 0.8125rem;
    margin-bottom: 2rem;
    transition: color 0.15s;
  }

  .browse-back:hover {
    color: var(--text-muted);
  }

  .browse-title {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .browse-subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .browse-field {
    margin-bottom: 1rem;
  }

  .browse-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  .browse-count {
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }
</style>
