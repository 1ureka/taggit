<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 是否正在送出 */
    pending: boolean;
    /** 目前勾選的數量 */
    checked: number;
    /** 關閉對話框事件 */
    onclose: () => void;
    /** 送出事件 */
    onsubmit: () => void;
  };

  let { pending, checked, onclose, onsubmit }: Props = $props();
</script>

<footer>
  <Button variant="ghost" status={pending ? "disabled" : undefined} onclick={onclose}>取消</Button>
  <Button variant="primary" status={pending ? "pending" : checked === 0 ? "disabled" : undefined} onclick={onsubmit}>
    送出 {checked} 筆操作
  </Button>
</footer>

<style>
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 1rem 1rem;
    border-top: var(--border-style);
  }
</style>
