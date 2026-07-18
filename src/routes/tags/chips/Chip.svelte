<script lang="ts">
  import type { Tag } from "$lib/database";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconAlertTriangleFilled } from "$lib/icons";
  import ChipTooltip from "./ChipTooltip.svelte";

  type Props = {
    /** 要呈現的標籤 */
    tag: Tag;
    /** 該標籤的目前草稿狀態 */
    status: "idle" | "group" | "delete" | "hidden";
    /** 該標籤目前是否被選取中 */
    selected: boolean;
    /** 點擊標籤事件 */
    onclick: () => void;
    /** 標籤拖曳開始事件 */
    ondragstart: () => void;
    /** 標籤拖曳結束事件 */
    ondragend: () => void;
  };

  let { tag, status, selected, onclick, ondragstart, ondragend }: Props = $props();

  const titleMap = {
    idle: "拖到右側分堆，或點選後用按鈕加入",
    group: "已排入合併堆",
    delete: "已排入刪除區",
    hidden: "已排入隱藏切換區",
  };
</script>

{#snippet detail()}<ChipTooltip {tag} />{/snippet}

<button
  type="button"
  class={{ selected, [status]: true }}
  draggable="true"
  aria-pressed={selected}
  title={`${tag.name} ${titleMap[status]}`}
  {onclick}
  {ondragstart}
  {ondragend}
  {@attach tooltip({ content: detail, placement: "bottom" })}
>
  <span class="ellipsis">{tag.name}</span>
  <span class="meta">
    {#if tag.meta.hidden}<IconAlertTriangleFilled size="0.75rem" />{/if}
    <span>{tag.count}</span>
  </span>
</button>

<style>
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 16rem;
    padding: 0.1875rem 0.625rem;
    font: var(--font-body2);
    color: hsl(from var(--color-text) h s l / 0.8);
    border: var(--border-style);
    border-radius: 9999px;
    cursor: grab;
    user-select: none;
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }
  }

  button {
    background-color: transparent;
    border-color: var(--color-border);

    &:hover {
      background-color: var(--color-bg-hover);
      border-color: var(--color-border-hover);
    }

    &.selected {
      background-color: var(--color-bg-hover);
      border-color: hsl(from var(--color-text) h s l / 0.5);
      color: var(--color-text);

      &:hover {
        background-color: var(--color-bg-active);
        border-color: hsl(from var(--color-text) h s l / 0.75);
      }
    }
  }

  button.group {
    background-color: hsl(from var(--color-accent) h s l / 0.15);
    border-color: hsl(from var(--color-accent) h s l / 0.5);

    &:hover {
      background-color: hsl(from var(--color-accent) h s l / 0.3);
      border-color: hsl(from var(--color-accent) h s l / 0.75);
    }

    &.selected {
      background-color: hsl(from var(--color-accent) h s l / 0.3);
      border-color: hsl(from var(--color-accent) h s l / 0.75);
      color: var(--color-accent);

      &:hover {
        background-color: hsl(from var(--color-accent) h s l / 0.45);
        border-color: hsl(from var(--color-accent) h s l / 0.85);
      }
    }
  }

  button.delete {
    background-color: hsl(from var(--color-error) h s l / 0.15);
    border-color: hsl(from var(--color-error) h s l / 0.5);

    &:hover {
      background-color: hsl(from var(--color-error) h s l / 0.3);
      border-color: hsl(from var(--color-error) h s l / 0.75);
    }

    &.selected {
      background-color: hsl(from var(--color-error) h s l / 0.3);
      border-color: hsl(from var(--color-error) h s l / 0.75);
      color: var(--color-error);

      &:hover {
        background-color: hsl(from var(--color-error) h s l / 0.45);
        border-color: hsl(from var(--color-error) h s l / 0.85);
      }
    }
  }

  button.hidden {
    background-color: hsl(from var(--color-warning) h s l / 0.15);
    border-color: hsl(from var(--color-warning) h s l / 0.5);

    &:hover {
      background-color: hsl(from var(--color-warning) h s l / 0.3);
      border-color: hsl(from var(--color-warning) h s l / 0.75);
    }

    &.selected {
      background-color: hsl(from var(--color-warning) h s l / 0.3);
      border-color: hsl(from var(--color-warning) h s l / 0.75);
      color: var(--color-warning);

      &:hover {
        background-color: hsl(from var(--color-warning) h s l / 0.45);
        border-color: hsl(from var(--color-warning) h s l / 0.85);
      }
    }
  }

  span.meta {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-muted);
  }

  span.meta > span {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }
</style>
