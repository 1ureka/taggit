<script lang="ts">
  import { FilterFields } from "./filterFields.svelte.js";
  import Autocomplete from "./Autocomplete.svelte";
  import Select from "./Select.svelte";

  type Props = {
    /** 是否允許隨機排序 */
    allowRandomSort?: boolean;
  };

  let { allowRandomSort = true }: Props = $props();

  const ui = new FilterFields();

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

  const sortOptions = $derived.by(() => {
    const baseOptions = [
      { value: "committedAt", label: "時間" },
      { value: "rating", label: "評分" },
      { value: "name", label: "名稱" },
    ];

    if (allowRandomSort) {
      baseOptions.push({ value: "random", label: "隨機" });
    }

    return baseOptions;
  });

  const orderOptions = [
    { value: "desc", label: "降冪" },
    { value: "asc", label: "升冪" },
  ];
</script>

<div class="fields">
  <label class="field">
    <span>名稱</span>
    <input
      class="text-input"
      type="text"
      placeholder="搜尋名稱..."
      bind:value={ui.search}
      oninput={ui.handleSearchChange}
    />
  </label>

  <div class="field">
    <span>包含的標籤</span>
    <Autocomplete bind:tags={ui.includedTags} variant="inline" placeholder="包含標籤..." onchange={ui.handleChange} />
  </div>

  <div class="field">
    <span>排除的標籤</span>
    <Autocomplete bind:tags={ui.excludedTags} variant="inline" placeholder="排除標籤..." onchange={ui.handleChange} />
  </div>

  <div class="field">
    <span>評等</span>
    <div>
      <Select bind:value={ui.ratingOp} options={ratingOpOptions} stretch onchange={ui.handleChange} />
      <Select bind:value={ui.rating} options={ratingOptions} stretch onchange={ui.handleChange} />
    </div>
  </div>

  <div class="field">
    <span>排序</span>
    <div>
      <Select bind:value={ui.sort} options={sortOptions} stretch onchange={ui.handleChange} />
      <Select bind:value={ui.order} options={orderOptions} stretch onchange={ui.handleChange} />
    </div>
  </div>
</div>

<style>
  div.fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  div.fields > .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;

    & > span {
      font-size: var(--font-size-body2);
      font-weight: 500;
      color: var(--text-muted);
    }

    & > div {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
  }
</style>
