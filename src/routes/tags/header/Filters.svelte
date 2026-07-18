<script lang="ts">
  import { TagQuery } from "$lib/query-spec";
  import Button from "$lib/components/actions/Button.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/widgets/SearchInput.svelte";

  type Props = {
    /** 目前的查詢值物件 */
    query: TagQuery;
    /** 目前選取的標籤數量 */
    selectedCount: number;
    /** 點擊清空選取事件 */
    onclear: () => void;
    /** 查詢參數改變事件 */
    onchange: (query: TagQuery) => void;
  };

  let { query, selectedCount, onclear, onchange }: Props = $props();

  const id = $props.id();

  const handleSearch = (search: string) => {
    onchange(new TagQuery(query.where.with({ name: search }), query.list));
  };

  const handleSortChange = (key: string) => {
    if (key === "count" || key === "name") {
      onchange(new TagQuery(query.where, query.list.with({ sort: key })));
    }
  };

  const handleFilterChange = (key: string) => {
    if (key === "all") onchange(new TagQuery(query.where.with({ hidden: undefined }), query.list));
    if (key === "hidden") onchange(new TagQuery(query.where.with({ hidden: true }), query.list));
    if (key === "visible") onchange(new TagQuery(query.where.with({ hidden: false }), query.list));
  };
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
      value={query.where.name ?? ""}
      onsearch={handleSearch}
    />
  </div>

  <Select
    id="{id}-sort"
    aria-label="排序"
    options={["count", "name"]}
    option={sortOption}
    value={query.list.sort}
    onchange={handleSortChange}
  />
  <Select
    id="{id}-hidden"
    aria-label="篩選"
    options={["all", "hidden", "visible"]}
    option={hiddenOption}
    value={query.where.hidden === undefined ? "all" : query.where.hidden ? "hidden" : "visible"}
    onchange={handleFilterChange}
  />

  {#if selectedCount > 0}
    <Button variant="ghost" onclick={onclear}>清空選取 ({selectedCount})</Button>
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
