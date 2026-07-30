<script lang="ts">
  import type { Snippet } from "svelte";
  import { isLeavingSelf } from "$lib/utils/dom";
  import { getDragContext } from "../logic/drag.svelte";
  import type { ZoneTarget } from "../logic/board.svelte";

  type Props = {
    /** 這個容器代表的拖放目標 */
    target: ZoneTarget;
    /** aria-label */
    "aria-label": string;
    /** 要渲染的內容 */
    children: Snippet;
    /** 額外樣式 */
    style?: string;
  };

  let { target, children, ...rest }: Props = $props();

  const drag = getDragContext();

  const variant = $derived(target.kind === "new-group" ? "create" : target.kind === "group" ? "group" : target.kind);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    drag.handleDragOver(target);
  };

  const handleDragLeave = (e: DragEvent) => {
    if (isLeavingSelf(e)) drag.handleDragLeave(target);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    drag.handleDrop(target);
  };
</script>

<div
  class={{ dropping: drag.isOver(target), [variant]: true }}
  role="group"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  {...rest}
>
  {@render children()}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.75rem;
    padding-top: 0.5rem;
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
    transition: all 0.15s ease;
  }

  div.create {
    border-style: dashed;
    border-color: var(--color-border);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-accent);
      background-color: hsl(from var(--color-accent) h s l / 0.15);
    }
  }

  div.group {
    border-style: solid;
    border-color: hsl(from var(--color-accent) h s l / 0.45);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-accent);
      background-color: hsl(from var(--color-accent) h s l / 0.15);
    }
  }

  div.delete {
    border-style: dashed;
    border-color: hsl(from var(--color-error) h s l / 0.45);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-error);
      background-color: hsl(from var(--color-error) h s l / 0.15);
    }
  }

  div.hidden {
    border-style: dashed;
    border-color: hsl(from var(--color-warning) h s l / 0.45);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-warning);
      background-color: hsl(from var(--color-warning) h s l / 0.15);
    }
  }
</style>
