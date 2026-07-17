<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 是否為當前拖放目標 */
    dropping: boolean;
    /** 目前選取標籤的數量 */
    selected: number;
    /** 成為拖放目標事件 */
    ondragover: (e: DragEvent) => void;
    /** 脫離拖放目標事件 */
    ondragleave: () => void;
    /** 拖放事件 */
    ondrop: (e: DragEvent) => void;
    /** 點擊創建堆事件 */
    oncreate: () => void;
  };

  let { dropping, selected, ondragover, ondragleave, ondrop, oncreate }: Props = $props();
</script>

<div class:dropping role="group" aria-label="新合併堆" {ondragover} {ondragleave} {ondrop}>
  <p>拖曳到這裡建立<b>合併堆</b></p>
  <Button
    variant="outlined"
    status={selected === 0 ? "disabled" : undefined}
    onclick={oncreate}
    style="font: var(--font-caption)">從選取中建立</Button
  >
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0.75rem;
    border: var(--border-style);
    border-style: dashed;
    border-radius: calc(var(--border-radius) * 1.5);
    transition: all 0.15s ease;

    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  div {
    border-color: var(--color-border);
    background-color: var(--color-bg);

    &.dropping {
      border-color: var(--color-info);
      background-color: hsl(from var(--color-info) h s l / 0.15);
    }
  }
</style>
