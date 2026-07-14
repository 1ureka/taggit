<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import ConfirmDialog from "$lib/widgets/ConfirmDialog.svelte";
  import { requestConfirm } from "$lib/widgets/confirm-events";
  import { addToast } from "$lib/components/floating/toast-events";

  const handleDefault = async () => {
    const ok = await requestConfirm("要繼續執行這個操作嗎？");
    addToast({ message: ok ? "已確認" : "已取消", variant: ok ? "success" : "info" });
  };

  const handleCustom = async () => {
    const ok = await requestConfirm("確定要刪除這 3 張圖片嗎？\n此操作無法復原。", {
      title: "刪除圖片",
      action: "刪除",
    });
    addToast({ message: ok ? "已刪除 3 張圖片" : "已取消", variant: ok ? "success" : "info" });
  };
</script>

<svelte:head>
  <title>ConfirmDialog</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <section>
        <h4>Defaults</h4>
        <Button onclick={handleDefault}>Confirm something</Button>
      </section>

      <section>
        <h4>Custom title & action</h4>
        <Button variant="destructive" onclick={handleCustom}>Delete images</Button>
      </section>
    </div>
  </PreviewCanvas>

  <!-- 在 app 殼層中為全域單例；lab 殼層沒有掛載，因此本頁自行掛一份 -->
  <ConfirmDialog />
{/snippet}

<PreviewLayout
  component="ConfirmDialog"
  label="Promise-based confirm"
  guide="A widget composing `Modal` + `Button` behind an event protocol. Call `await requestConfirm(message, options)` from any module — the singleton mounted in the app shell answers with a boolean. Closing via backdrop or [[Escape]] resolves to `false`."
  {preview}
/>

<style>
  .container {
    display: flex;
    gap: 1.5rem;
  }

  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  section > h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);
  }
</style>
