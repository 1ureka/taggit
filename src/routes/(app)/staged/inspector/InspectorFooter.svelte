<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 是否正在處理中 */
    pending: boolean;
    /** 點擊清空按紐事件 */
    onclear: () => void;
    /** 點擊刪除按紐事件 */
    ondelete: () => void;
  };

  let { pending, onclear, ondelete }: Props = $props();

  const clearStatus = $derived(pending ? "disabled" : undefined);
  const deleteStatus = $derived(pending ? "pending" : undefined);
</script>

<footer>
  <Button variant="outlined" status={clearStatus} onclick={onclear}>清空草稿</Button>
  <Button variant="destructive" status={deleteStatus} onclick={ondelete}>刪除此張</Button>
</footer>

<style>
  footer {
    padding: 0.75rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: stretch;
    gap: 0.5rem;
    margin-top: auto;
  }
</style>
