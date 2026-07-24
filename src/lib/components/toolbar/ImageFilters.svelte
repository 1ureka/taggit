<script lang="ts">
  import type { ImageWhere } from "$lib/query-spec";
  import { IconFilter } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";
  import Select from "$lib/components/inputs/Select.svelte";

  type Props = {
    /** 目前的篩選條件 */
    where: ImageWhere;
    /** 目前的切片查詢範圍 */
    scope: string;
    /** 標籤變動事件 */
    onchangetags: (type: "includedTags" | "excludedTags", tags: string[]) => void;
    /** 評等變動事件 */
    onchangeratingop: (key: string) => void;
    /** 評等變動事件 */
    onchangerating: (key: string) => void;
  };

  const { where, scope, onchangetags, onchangerating, onchangeratingop }: Props = $props();

  const id = $props.id();
  let open = $state(false);
  let reference = $state<HTMLElement>();
  let panel = $state<HTMLDivElement>();

  const count = $derived.by(() => {
    return (
      (where.includedTags.length > 0 ? 1 : 0) +
      (where.excludedTags.length > 0 ? 1 : 0) +
      (where.rating !== undefined ? 1 : 0)
    );
  });

  const ratingOptions = ["all", "1", "2", "3", "4", "5"];
  const ratingOpOptions = ["gte", "lte", "eq"] as const;
  const ratingOpLabels: Record<string, string> = { gte: "≥", lte: "≤", eq: "=" };

  const handleToggle = () => {
    open = !open;
  };

  const handleClose = () => {
    open = false;
  };

  const handleWindowPointerDown = (e: PointerEvent) => {
    // pointerdown 早於 click 觸發，避免某些 DOM 已被 Svelte 拔除導致 contains 誤判
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (reference?.contains(target) || panel?.contains(target)) return;
    handleClose();
  };

  const handleWindowFocusIn = (e: FocusEvent) => {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    // 焦點所在節點被移除時瀏覽器會把焦點重置到 body，這是假訊號而非使用者主動移出面板
    if (target === document.body) return;
    if (reference?.contains(target) || panel?.contains(target)) return;
    handleClose();
  };

  const handleWindowKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) handleClose();
  };
</script>

<svelte:window
  onpointerdown={handleWindowPointerDown}
  onfocusin={handleWindowFocusIn}
  onkeydown={handleWindowKeydown}
/>

<span bind:this={reference}>
  <Button variant="outlined" aria-label="開啟篩選選單" onclick={handleToggle}>
    <IconFilter size={16} />
    <span>篩選</span>
    {#if count > 0}
      <span class="badge">{count}</span>
    {/if}
  </Button>
</span>

{#snippet ratingOpOption(key: string)}{ratingOpLabels[key] ?? key}{/snippet}
{#snippet ratingOption(key: string)}{key === "all" ? "全部" : key}{/snippet}

<Popover {open} {reference} placement="bottom-start">
  <div bind:this={panel} class="panel">
    <TagInput
      tags={where.includedTags}
      {scope}
      label="包含的標籤"
      onchange={(tags) => onchangetags("includedTags", tags)}
    />
    <TagInput
      tags={where.excludedTags}
      {scope}
      label="排除的標籤"
      onchange={(tags) => onchangetags("excludedTags", tags)}
    />
    <div>
      <span>評等</span>
      <div>
        <Select
          id="{id}-rating-op"
          aria-label="評等比較運算"
          options={ratingOpOptions}
          option={ratingOpOption}
          value={where.ratingOp}
          onchange={onchangeratingop}
        />
        <Select
          id="{id}-rating"
          aria-label="評等"
          options={ratingOptions}
          option={ratingOption}
          value={where.rating ? String(where.rating) : "all"}
          onchange={onchangerating}
        />
      </div>
    </div>
  </div>
</Popover>

<style>
  span.badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }

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
