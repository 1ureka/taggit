<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 是否正在送出中 */
    pending: boolean;
    /** 準備送出的數量 */
    count: number;
    /** 點擊取消事件 */
    oncancel: () => void;
    /** 點擊送出事件 */
    onsubmit: () => void;
    /** 要渲染的額外內容 */
    children?: Snippet;
  };

  const { pending, count, oncancel, onsubmit, children }: Props = $props();
</script>

<footer>
  {@render children?.()}
  <div>
    <Button variant="ghost" status={pending ? "disabled" : undefined} onclick={oncancel}>取消</Button>
    <Button variant="primary" status={pending ? "pending" : count === 0 ? "disabled" : undefined} onclick={onsubmit}>
      送出 {count} 筆操作
    </Button>
  </div>
</footer>

<style>
  footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-top: var(--border-style);
  }

  div {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
