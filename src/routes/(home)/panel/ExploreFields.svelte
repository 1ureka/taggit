<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { ImageQuery, ImageWhere, ListOptions, IMAGE_SORTS, type ImageSort } from "$lib/query-spec";

  import Select from "$lib/components/inputs/Select.svelte";
  import SearchInput from "$lib/widgets/SearchInput.svelte";
  import TagInput from "$lib/widgets/TagInput.svelte";

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

  /** 由目前欄位組出查詢值物件，寫回 URL */
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

    const params = new ImageQuery(where, list).toSearchParams(page.url.searchParams);
    const qs = params.toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };

  // ---

  const ratingOptions = ["all", "1", "2", "3", "4", "5"];
  const ratingOpOptions = ["gte", "lte", "eq"];
  const ratingOpLabels: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

  const sortOptions = [...IMAGE_SORTS];
  const sortLabels: Record<string, string> = { committedAt: "時間", rating: "評分", name: "名稱", random: "隨機" };

  const orderOptions = ["desc", "asc"];
  const orderLabels: Record<string, string> = { desc: "降冪", asc: "升冪" };

  const createSelectHandler = (type: "rating" | "ratingOp" | "sort" | "order") => (key: string) => {
    if (type === "rating") ratingKey = key;
    if (type === "ratingOp") ratingOpKey = key;
    if (type === "sort") sortKey = key;
    if (type === "order") orderKey = key;
    apply();
  };
</script>

{#snippet ratingOpOption(key: string)}{ratingOpLabels[key] ?? key}{/snippet}
{#snippet ratingOption(key: string)}{key === "all" ? "全部" : key}{/snippet}
{#snippet sortOption(key: string)}{sortLabels[key] ?? key}{/snippet}
{#snippet orderOption(key: string)}{orderLabels[key] ?? key}{/snippet}

<div class="fields">
  <div class="field">
    <span class="field-label">名稱</span>
    <SearchInput bind:value={search} label="搜尋名稱" labelHidden placeholder="搜尋名稱…" onsearch={() => apply()} />
  </div>

  <div class="field">
    <TagInput bind:tags={includedTags} scope={facetScope} label="包含的標籤" onchange={() => apply()} />
  </div>

  <div class="field">
    <TagInput bind:tags={excludedTags} scope={facetScope} label="排除的標籤" onchange={() => apply()} />
  </div>

  <div class="field">
    <span class="field-label">評等</span>
    <div class="field-pair">
      <Select
        id="{id}-rating-op"
        aria-label="評等比較運算"
        options={ratingOpOptions}
        option={ratingOpOption}
        bind:value={ratingOpKey}
        onchange={createSelectHandler("ratingOp")}
      />
      <Select
        id="{id}-rating"
        aria-label="評等"
        options={ratingOptions}
        option={ratingOption}
        bind:value={ratingKey}
        onchange={createSelectHandler("rating")}
      />
    </div>
  </div>

  <div class="field">
    <span class="field-label">排序</span>
    <div class="field-pair">
      <Select
        id="{id}-sort"
        aria-label="排序欄位"
        options={sortOptions}
        option={sortOption}
        bind:value={sortKey}
        onchange={createSelectHandler("sort")}
      />
      <Select
        id="{id}-order"
        aria-label="排序方向"
        options={orderOptions}
        option={orderOption}
        bind:value={orderKey}
        onchange={createSelectHandler("order")}
        disabled={sortKey === "random"}
      />
    </div>
  </div>
</div>

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border-bottom: var(--border-style);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font: var(--font-body2);
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .field-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: stretch;
    gap: 0.5rem;
  }
</style>
