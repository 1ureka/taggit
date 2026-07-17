<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    /** 合併堆的名稱 */
    label: string;
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
  };

  let { label, children, dropping, ondragover, ondragleave, ondrop }: Props = $props();
</script>

<div class:dropping role="group" aria-label={`合併堆 ${label}`} {ondragover} {ondragleave} {ondrop}>
  {@render children()}
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.75rem;
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
    transition: all 0.15s ease;
  }

  div {
    border-color: hsl(from var(--color-info) h s l / 0.45);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-info);
      background-color: hsl(from var(--color-info) h s l / 0.15);
    }
  }
</style>
