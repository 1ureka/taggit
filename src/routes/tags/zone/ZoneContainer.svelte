<script lang="ts">
  import type { Snippet } from "svelte";
  import { getDragContext, type ZoneTarget } from "../logic/drag.svelte";

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
  const handlers = $derived(drag.zoneHandlers(target));

  const variant = $derived(target.kind === "new-group" ? "create" : target.kind === "group" ? "group" : target.kind);
</script>

<div
  class={{ dropping: handlers.dropping, [variant]: true }}
  role="group"
  ondragover={handlers.ondragover}
  ondragleave={handlers.ondragleave}
  ondrop={handlers.ondrop}
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
