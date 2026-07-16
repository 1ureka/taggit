<script lang="ts">
  import Popover from "$lib/components/floating/Popover.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import TagInput from "$lib/widgets/TagInput.svelte";

  type Props = {
    /** 開關狀態（雙向綁定；外部點擊與 Escape 會在此關閉） */
    open: boolean;
    /** 定位錨點（toolbar 的篩選按鈕） */
    reference: HTMLElement | undefined;
    /** 包含的標籤（雙向綁定） */
    includedTags: string[];
    /** 排除的標籤（雙向綁定） */
    excludedTags: string[];
    /** 評等值 key（"all" | "1"~"5"，雙向綁定） */
    ratingKey: string | undefined;
    /** 評等比較運算 key（雙向綁定） */
    ratingOpKey: string | undefined;
    /** 標籤分面查詢的 scope */
    facetScope: string;
    /** 任一欄位變動即套用 */
    onchange: () => void;
  };

  let {
    open = $bindable(false),
    reference,
    includedTags = $bindable(),
    excludedTags = $bindable(),
    ratingKey = $bindable(),
    ratingOpKey = $bindable(),
    facetScope,
    onchange,
  }: Props = $props();

  const id = $props.id();

  let panelRef = $state<HTMLDivElement>();

  const ratingOptions = ["all", "1", "2", "3", "4", "5"];
  const ratingOpOptions = ["gte", "lte", "eq"];
  const ratingOpLabels: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

  // ---

  function handleWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (reference?.contains(target) || panelRef?.contains(target)) return;
    open = false;
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      open = false;
    }
  }
</script>

{#snippet ratingOpOption(key: string)}{ratingOpLabels[key] ?? key}{/snippet}
{#snippet ratingOption(key: string)}{key === "all" ? "全部" : key}{/snippet}

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<Popover {open} {reference} placement="bottom-start" offset={8}>
  <div bind:this={panelRef} class="panel">
    <div class="field">
      <TagInput bind:tags={includedTags} scope={facetScope} label="包含的標籤" onchange={() => onchange()} />
    </div>

    <div class="field">
      <TagInput bind:tags={excludedTags} scope={facetScope} label="排除的標籤" onchange={() => onchange()} />
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
          onchange={() => onchange()}
        />
        <Select
          id="{id}-rating"
          aria-label="評等"
          options={ratingOptions}
          option={ratingOption}
          bind:value={ratingKey}
          onchange={() => onchange()}
        />
      </div>
    </div>
  </div>
</Popover>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(20rem, 90dvw);
    padding: 0.75rem;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
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
