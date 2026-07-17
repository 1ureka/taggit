<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    /** 該容器的用途 */
    variant: "create" | "group" | "delete" | "hidden";
    /** aria-label */
    "aria-label": string;
    /** 要渲染的內容 */
    children: Snippet;
    /** 是否為當前拖放目標 */
    dropping: boolean;
    /** 成為拖放目標事件 */
    ondragover: (e: DragEvent) => void;
    /** 脫離拖放目標事件 */
    ondragleave: () => void;
    /** 拖放事件 */
    ondrop: (e: DragEvent) => void;
    /** 額外樣式 */
    style?: string;
  };

  let { variant, children, dropping, ...rest }: Props = $props();
</script>

<div class={{ dropping, [variant]: true }} role="group" {...rest}>{@render children()}</div>

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
    border-color: var(--color-border);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-destructive);
      background-color: hsl(from var(--color-destructive) h s l / 0.15);
    }
  }

  div.hidden {
    border-style: dashed;
    border-color: var(--color-border);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-warning);
      background-color: hsl(from var(--color-warning) h s l / 0.15);
    }
  }
</style>
