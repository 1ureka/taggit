<script lang="ts">
  import type { ImageSort, ListOptions } from "$lib/query-spec";
  import { IconSortFilled, IconCheck } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";

  type Props = {
    /** 目前的排序條件 */
    list: ListOptions<ImageSort>;
    /** 排序欄位變動事件 */
    onchangesort: (key: string) => void;
    /** 排序方向變動事件 */
    onchangeorder: (key: string) => void;
  };

  const { list, onchangesort, onchangeorder }: Props = $props();

  let open = $state(false);
  let reference = $state<HTMLElement>();
  let panel = $state<HTMLDivElement>();

  const sortOptions = ["committedAt", "rating", "name", "random"] as const;
  const sortLabels: Record<string, string> = { committedAt: "時間", rating: "評分", name: "名稱", random: "隨機" };
  const orderOptions = ["desc", "asc"] as const;
  const orderLabels: Record<string, string> = { desc: "降冪", asc: "升冪" };
  const orderDisabled = $derived(list.sort === "random");

  const handleToggle = () => {
    open = !open;
  };

  const handleClose = () => {
    open = false;
  };

  const handleWindowClick = (e: MouseEvent) => {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (reference?.contains(target) || panel?.contains(target)) return;
    handleClose();
  };

  const handleWindowKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) handleClose();
  };
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<span bind:this={reference}>
  <Button variant="outlined" aria-label="開啟排序選單" onclick={handleToggle}>
    <IconSortFilled size={16} />
    <span>排序</span>
  </Button>
</span>

<Popover {open} {reference} placement="bottom-start">
  <div bind:this={panel} class="panel">
    <div role="radiogroup" aria-label="排序欄位">
      <span>排序欄位</span>
      {#each sortOptions as key (key)}
        <button
          type="button"
          role="radio"
          aria-checked={key === list.sort}
          class:selected={key === list.sort}
          onclick={() => onchangesort(key)}
        >
          <span class="ellipsis">{sortLabels[key] ?? key}</span>
          {#if key === list.sort}
            <IconCheck size={16} />
          {/if}
        </button>
      {/each}
    </div>
    <div role="radiogroup" aria-label="排序方向">
      <span>排序方向</span>
      {#each orderOptions as key (key)}
        <button
          type="button"
          role="radio"
          aria-checked={key === list.order}
          disabled={orderDisabled}
          class:selected={key === list.order}
          onclick={() => onchangeorder(key)}
        >
          <span class="ellipsis">{orderLabels[key] ?? key}</span>
          {#if key === list.order}
            <IconCheck size={16} />
          {/if}
        </button>
      {/each}
    </div>
  </div>
</Popover>

<style>
  div.panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(11rem, 90dvw);
    padding: 0.5rem;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
  }

  div.panel > div {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  div.panel > div > span {
    padding: 0.1rem 0.25rem;
    font: var(--font-body2);
    font-weight: 500;
    color: var(--color-text-muted);
  }

  button[role="radio"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    font: var(--font-body2);
    color: var(--color-text);
    text-align: left;
    border-radius: calc(var(--border-radius) * 1.5 - 0.25rem);
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }

    &:disabled {
      opacity: 0.5;
      pointer-events: none;
    }
  }

  button[role="radio"] {
    background-color: transparent;

    &:hover {
      background-color: var(--color-bg-hover);
    }
  }

  button[role="radio"].selected {
    color: var(--color-accent);
    background-color: hsl(from var(--color-accent) h s l / 0.15);

    &:hover {
      color: var(--color-accent);
      background-color: hsl(from var(--color-accent) h s l / 0.25);
    }
  }
</style>
