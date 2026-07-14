<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { addToast, withProgressToast, showToasts } from "$lib/components/floating/toast-events";

  let running = $state(false);

  const runProgressDemo = async (shouldFail: boolean) => {
    if (running) return;
    running = true;

    await withProgressToast(
      async (update) => {
        for (let pct = 0; pct <= 100; pct += 20) {
          update(pct / 100, `上傳中… ${pct}%`);
          await new Promise((r) => setTimeout(r, 300));
        }
        if (shouldFail) throw new Error("網路連線中斷");
      },
      (error) => (error instanceof Error ? error.message : "未知的錯誤"),
    );

    running = false;
  };

  const loneText =
    "已從 `main` 分支拉取最新變更，共 128 個檔案、3,402 行新增與 891 行刪除。按 [[Enter]] 可以查看完整的變更紀錄。";

  const toasts = {
    success: { message: "已儲存變更", variant: "success" },
    error: { message: "找不到該筆資料", variant: "error" },
    info: { message: "已同步至**最新版本**", variant: "info" },
    longText: { message: loneText, variant: "info" },
  } as const;
</script>

<svelte:head>
  <title>Toast</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <section>
        <h4>Variants</h4>
        <div class="row">
          <Button onclick={() => addToast(toasts.success)}>Success</Button>
          <Button onclick={() => addToast(toasts.error)}>Error</Button>
          <Button onclick={() => addToast(toasts.info)}>Info</Button>
        </div>
      </section>

      <section>
        <h4>Progress</h4>
        <div class="row">
          <Button status={running ? "disabled" : undefined} onclick={() => runProgressDemo(false)}>
            模擬上傳（成功）
          </Button>
          <Button status={running ? "disabled" : undefined} onclick={() => runProgressDemo(true)}>
            模擬上傳（失敗）
          </Button>
        </div>
      </section>

      <section>
        <h4>Long text &amp; markup</h4>
        <div class="row">
          <Button onclick={() => addToast(toasts.longText)}>長文字 + markup</Button>
        </div>
      </section>

      <section>
        <h4>History</h4>
        <div class="row">
          <Button variant="outlined" onclick={showToasts}>開啟通知歷史</Button>
        </div>
      </section>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout component="Toast" label="Stacked notifications with a history mode" {preview} />

<style>
  .container {
    display: flex;
    flex-direction: column;
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

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
</style>
