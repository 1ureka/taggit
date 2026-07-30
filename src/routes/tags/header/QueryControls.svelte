<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/components/widgets/SearchInput.svelte";
  import { getQueryContext } from "../logic/query.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const query = getQueryContext();
  const selection = getSelectionContext();

  const id = $props.id();
</script>

{#snippet sortOption(key: string)}
  {key === "count" ? "使用數" : "名稱"}
{/snippet}

{#snippet hiddenOption(key: string)}
  {key === "all" ? "全部標籤" : key === "hidden" ? "僅隱藏標籤" : "僅可見標籤"}
{/snippet}

<div>
  <div>
    <SearchInput
      label="搜尋標籤"
      labelHidden
      placeholder="搜尋標籤…"
      value={query.query.where.name ?? ""}
      onsearch={query.handleSearch}
    />
  </div>

  <Select
    id="{id}-sort"
    aria-label="排序"
    options={["count", "name"]}
    option={sortOption}
    value={query.query.list.sort}
    onchange={query.handleSortChange}
  />
  <Select
    id="{id}-hidden"
    aria-label="篩選"
    options={["all", "hidden", "visible"]}
    option={hiddenOption}
    value={query.query.where.hidden === undefined ? "all" : query.query.where.hidden ? "hidden" : "visible"}
    onchange={query.handleHiddenFilterChange}
  />

  {#if selection.size > 0}
    <Button variant="ghost" onclick={selection.handleClear}>清空選取 ({selection.size})</Button>
  {/if}
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  div > div:nth-of-type(1) {
    flex: 1;
    min-width: 8rem;
    width: 100%;
    max-width: 16rem;
  }
</style>
