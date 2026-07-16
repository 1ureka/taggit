<script lang="ts">
  import { page } from "$app/state";
  import { ImageQuery, ImageWhere, ListOptions, IMAGE_SORTS, type ImageSort } from "$lib/query-spec";

  import { IconArrowsShuffle, IconReload } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/widgets/SearchInput.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import FilterPopover from "./FilterPopover.svelte";
  import FilterButton from "./FilterButton.svelte";

  type Props = {
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 套用查詢：由頁面寫回 URL（保留 pinned）並重跑 load */
    onapply: (query: ImageQuery) => void;
    /** 隨機抽選 N 張 */
    onshuffle: (count: number) => void;
    /** 重新整理列表 */
    onrefresh: () => void;
  };

  let { pending, onapply, onshuffle, onrefresh }: Props = $props();

  const id = $props.id();

  // URL 是查詢的唯一真相源，使用者互動覆寫後由 apply() 寫回 URL，load 重跑後回到 URL 解析值
  const query = $derived(ImageQuery.fromSearchParams(page.url.searchParams));

  let search = $derived(query.where.search);
  let includedTags = $derived(query.where.includedTags);
  let excludedTags = $derived(query.where.excludedTags);
  let ratingKey = $derived<string | undefined>(query.where.rating === undefined ? "all" : String(query.where.rating));
  let ratingOpKey = $derived<string | undefined>(query.where.ratingOp);
  let sortKey = $derived<string | undefined>(query.list.sort);
  let orderKey = $derived<string | undefined>(query.list.order);

  /** 標籤分面查詢的 scope：當前 URL 的圖片篩選條件 */
  const facetScope = $derived(ImageWhere.fromSearchParams(page.url.searchParams).toSearchParams().toString());

  // ---

  /** 由目前欄位組出查詢值物件，交由頁面寫回 URL */
  const apply = () => {
    const where = new ImageWhere({
      search,
      includedTags,
      excludedTags,
      rating: !ratingKey || ratingKey === "all" ? undefined : Number(ratingKey),
      ratingOp: (ratingOpKey ?? "gte") as "gte" | "lte" | "eq",
    });

    const list = new ListOptions<ImageSort>({
      sort: (sortKey ?? "rating") as ImageSort,
      order: (orderKey ?? "desc") as "asc" | "desc",
    });

    onapply(new ImageQuery(where, list));
  };

  // ---

  const sortOptions = [...IMAGE_SORTS];
  const sortLabels: Record<string, string> = { committedAt: "時間", rating: "評分", name: "名稱", random: "隨機" };

  const orderOptions = ["desc", "asc"];
  const orderLabels: Record<string, string> = { desc: "降冪", asc: "升冪" };

  const shuffleOptions = ["2", "3", "4", "6"];
  let shuffleKey = $state<string | undefined>("2");

  // ---

  let filterOpen = $state(false);
  let filterAnchor = $state<HTMLElement>();
</script>

{#snippet sortOption(key: string)}{sortLabels[key] ?? key}{/snippet}
{#snippet orderOption(key: string)}{orderLabels[key] ?? key}{/snippet}
{#snippet shuffleOption(key: string)}{`抽 ${key} 張`}{/snippet}

<div class="toolbar">
  <div class="filters">
    <div class="search">
      <SearchInput bind:value={search} label="搜尋名稱" labelHidden placeholder="搜尋名稱…" onsearch={() => apply()} />
    </div>

    <Select
      id="{id}-sort"
      aria-label="排序欄位"
      options={sortOptions}
      option={sortOption}
      bind:value={sortKey}
      onchange={() => apply()}
    />
    <Select
      id="{id}-order"
      aria-label="排序方向"
      options={orderOptions}
      option={orderOption}
      bind:value={orderKey}
      onchange={() => apply()}
      status={sortKey === "random" ? "disabled" : "default"}
    />

    <span bind:this={filterAnchor}>
      <FilterButton aria-expanded={filterOpen} onclick={() => (filterOpen = !filterOpen)} />
    </span>
  </div>

  <div class="actions">
    <Button
      variant="ghost"
      padding="icon"
      aria-label="重新整理"
      status={pending ? "pending" : undefined}
      onclick={onrefresh}
      {@attach tooltip({ content: "重新整理" })}
    >
      <IconReload size={16} />
    </Button>

    <Select
      id="{id}-shuffle-count"
      aria-label="抽選張數"
      options={shuffleOptions}
      option={shuffleOption}
      bind:value={shuffleKey}
      matchWidth={false}
    />
    <Button variant="primary" onclick={() => onshuffle(Number(shuffleKey ?? "2"))}>
      <IconArrowsShuffle size={16} />
      <span>隨機抽選</span>
    </Button>
  </div>
</div>

<FilterPopover
  bind:open={filterOpen}
  reference={filterAnchor}
  bind:includedTags
  bind:excludedTags
  bind:ratingKey
  bind:ratingOpKey
  {facetScope}
  onchange={() => apply()}
/>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.5rem 1rem;
    border-bottom: var(--border-style);
  }

  .filters,
  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search {
    width: clamp(8rem, 24vw, 16rem);
  }
</style>
