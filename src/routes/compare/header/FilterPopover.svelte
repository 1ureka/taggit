<script lang="ts">
  import { page } from "$app/state";
  import { ImageQuery, ImageWhere } from "$lib/query-spec";
  import Popover from "$lib/components/floating/Popover.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import TagInput from "$lib/widgets/TagInput.svelte";

  type Props = {
    /** 當前的查詢值物件 */
    query: ImageQuery;
    /** 選單的開關狀態 */
    open: boolean;
    /** 選單的定位錨點 */
    reference: HTMLElement | undefined;
    /** 查詢值物件改變事件 */
    onchange: (query: ImageQuery) => void;
    /** 關閉選單事件 */
    onclose: () => void;
  };

  let { open, reference, query, onchange, onclose }: Props = $props();

  const id = $props.id();
  const facetScope = $derived(ImageWhere.fromSearchParams(page.url.searchParams).toSearchParams().toString());

  let panelRef = $state<HTMLDivElement>();

  const ratingOptions = ["all", "1", "2", "3", "4", "5"];
  const ratingOpOptions = ["gte", "lte", "eq"] as const;
  const ratingOpLabels: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

  // ---

  const createHandleTagsChange = (type: "includedTags" | "excludedTags") => (tags: string[]) => {
    onchange(new ImageQuery(query.where.with({ [type]: tags }), query.list));
  };

  const handleRatingChange = (key: string) => {
    const rating = key === "all" ? undefined : Number(key);
    onchange(new ImageQuery(query.where.with({ rating }), query.list));
  };

  const handleRatingOpChange = (key: string) => {
    if (key === "gte" || key === "lte" || key === "eq") {
      onchange(new ImageQuery(query.where.with({ ratingOp: key }), query.list));
    }
  };

  function handleWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (reference?.contains(target) || panelRef?.contains(target)) return;
    onclose();
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) onclose();
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

{#snippet ratingOpOption(key: string)}{ratingOpLabels[key] ?? key}{/snippet}
{#snippet ratingOption(key: string)}{key === "all" ? "全部" : key}{/snippet}

<Popover {open} {reference} placement="bottom-start">
  <div bind:this={panelRef} class="panel">
    <TagInput
      tags={query.where.includedTags}
      scope={facetScope}
      label="包含的標籤"
      onchange={createHandleTagsChange("includedTags")}
    />
    <TagInput
      tags={query.where.excludedTags}
      scope={facetScope}
      label="排除的標籤"
      onchange={createHandleTagsChange("excludedTags")}
    />
    <div>
      <span>評等</span>
      <div>
        <Select
          id="{id}-rating-op"
          aria-label="評等比較運算"
          options={ratingOpOptions}
          option={ratingOpOption}
          value={query.where.ratingOp}
          onchange={handleRatingOpChange}
        />
        <Select
          id="{id}-rating"
          aria-label="評等"
          options={ratingOptions}
          option={ratingOption}
          value={query.where.rating ? String(query.where.rating) : "all"}
          onchange={handleRatingChange}
        />
      </div>
    </div>
  </div>
</Popover>

<style>
  div.panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(20rem, 90dvw);
    padding: 0.75rem;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
  }

  div.panel > div {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  div.panel > div > span {
    font: var(--font-body2);
    font-weight: 500;
    color: var(--color-text-muted);
  }

  div.panel > div > div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: stretch;
    gap: 0.5rem;
  }
</style>
