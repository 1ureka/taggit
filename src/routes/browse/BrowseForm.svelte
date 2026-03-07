<script lang="ts">
  import { IconPlayerPlay, IconArrowLeft } from "@tabler/icons-svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Select from "$lib/components/Select.svelte";
  import { createForm } from "./browseForm.svelte.js";

  let { matchCount }: { matchCount: number } = $props();

  const ui = createForm({
    debounceTime: 200,
    get matchCount() {
      return matchCount;
    },
    set matchCount(v) {
      matchCount = v;
    },
  });

  let startDisabled = $derived(matchCount === 0);
  let countText = $derived(ui.loading ? "查詢中..." : `共 ${matchCount} 張符合`);
</script>

<div class="container slide-up">
  <a href="/" class="btn-back">
    <IconArrowLeft size={16} />
    返回首頁
  </a>

  <h1 class="title">水平瀏覽</h1>
  <p class="subtitle">設定篩選條件後開始瀏覽</p>

  <div class="field">
    <span class="label">標籤篩選</span>
    <Autocomplete bind:tags={ui.tags} variant="top" placeholder="添加標籤..." onchange={ui.handleFormTagChange} />
  </div>

  <div class="field">
    <span class="label">最低評等</span>
    <Rating bind:value={ui.rating} size="1.5rem" onchange={ui.handleFormRatingChange} />
  </div>

  <div class="field">
    <span class="label">排序</span>
    <Select bind:value={ui.sort} options={ui.sortOptions} size="md" stretch />
  </div>

  <div class="count">{countText}</div>

  <button class="btn btn-primary" style="width:100%" disabled={startDisabled} onclick={ui.handleFormSubmit}>
    <IconPlayerPlay size={18} />
    開始瀏覽
  </button>
</div>

<style>
  .container {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-dim);
    font-size: 0.8125rem;
    margin-bottom: 2rem;
    transition: color 0.15s;

    &:hover {
      color: var(--text-muted);
    }
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .field {
    margin-bottom: 1rem;
  }

  .label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  .count {
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }
</style>
