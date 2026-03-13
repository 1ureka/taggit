<script lang="ts">
  import { IconPlayerPlay } from "@tabler/icons-svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Select from "$lib/components/Select.svelte";
  import { createBrowseForm } from "./browseForm.svelte.js";

  let { matchCount }: { matchCount: number } = $props();

  const ui = createBrowseForm({
    debounceTime: 200,
    get matchCount() {
      return matchCount;
    },
    set matchCount(v) {
      matchCount = v;
    },
  });
</script>

<div>
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

  <div class="count">{ui.countText}</div>

  <button class="btn btn-primary" style="width:100%" disabled={ui.startDisabled} onclick={ui.handleFormSubmit}>
    <IconPlayerPlay size={18} />
    開始瀏覽
  </button>
</div>

<style>
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
