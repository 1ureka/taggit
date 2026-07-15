<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 目前正在編輯的檔案的檔案名稱 */
    file: string;
    /** 是否正在處理中 */
    pending: boolean;
    /** 點擊清空按紐 */
    onclear: () => void;
  };

  let { pending, onclear }: Props = $props();

  const handleDelete = () => {
    // TODO: 開啟 confirmDialog 並在確認後，透過 file 來寄送 api 刪除
  };

  const clearStatus = $derived(pending ? "disabled" : undefined);
  const deleteStatus = $derived(pending ? "pending" : undefined);
</script>

<footer>
  <Button variant="outlined" status={clearStatus} onclick={onclear}>清空草稿</Button>
  <Button variant="destructive" status={deleteStatus} onclick={handleDelete}>刪除此張</Button>
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
