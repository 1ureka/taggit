<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { api } from "$lib/utils/request";

  import { addToast } from "$lib/components/floating/toast-events";
  import { requestConfirm } from "$lib/widgets/confirm-events";
  import { IconAlertCircleFilled, IconDatabase } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ToolCard from "./ToolCard.svelte";

  // ---

  /** 缺失檔案 ID 列表（null 表示尚未檢查） */
  let missingList = $state<string[] | null>(null);
  let missingBusy = $state(false);

  const missingResult = $derived.by(() => {
    if (missingList === null) return undefined;
    if (missingList.length === 0) return "沒有找到缺失記錄";
    return `找到 ${missingList.length} 個缺失記錄`;
  });

  const handleMissingCheck = async () => {
    missingBusy = true;
    const res = await api.get<{ missing: string[] }>("/api/settings/missing");
    missingBusy = false;

    if (res.ok && res.data) {
      missingList = res.data.missing;
    } else {
      addToast({ message: `檢查失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
    }
  };

  const handleMissingDelete = async () => {
    if (missingList === null) return;

    const msg = `確定要刪除 ${missingList.length} 個缺失記錄？此操作無法復原。`;
    if (!(await requestConfirm(msg, { title: "刪除記錄", action: "刪除" }))) return;

    missingBusy = true;
    const res = await api.del<{ removed: string[] }>("/api/settings/missing");
    missingBusy = false;

    if (res.ok && res.data) {
      addToast({ message: `已刪除 ${res.data.removed.length} 個缺失記錄`, variant: "success" });
      missingList = [];
      await invalidateAll();
    } else {
      addToast({ message: `刪除失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
    }
  };

  // ---

  let backupBusy = $state(false);

  const handleBackup = async () => {
    backupBusy = true;
    try {
      const res = await fetch("/api/settings/backup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        addToast({ message: `備份失敗：${data.error ?? "未知錯誤"}`, variant: "error" });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      addToast({ message: "備份已下載", variant: "success" });
    } catch {
      addToast({ message: "備份失敗", variant: "error" });
    } finally {
      backupBusy = false;
    }
  };
</script>

<ToolCard
  Icon={IconAlertCircleFilled}
  title="缺失檔案檢查"
  description="找出資料庫有記錄但對應檔案已不存在的項目，通常因曾手動刪除檔案而產生，檢查後可選擇移除這些失效的記錄。"
  result={missingResult}
>
  {#snippet actions()}
    <Button variant="outlined" padding="sm" status={missingBusy ? "pending" : undefined} onclick={handleMissingCheck}>
      開始檢查
    </Button>
    {#if missingList !== null && missingList.length > 0}
      <Button
        variant="destructive"
        padding="sm"
        status={missingBusy ? "disabled" : undefined}
        onclick={handleMissingDelete}
      >
        刪除 {missingList.length} 個缺失記錄
      </Button>
    {/if}
  {/snippet}
</ToolCard>

<ToolCard Icon={IconDatabase} title="備份" description="將目前的圖片集打包為 ZIP 備份檔，下載至你的裝置。">
  {#snippet actions()}
    <Button variant="outlined" padding="sm" status={backupBusy ? "pending" : undefined} onclick={handleBackup}>
      下載備份
    </Button>
  {/snippet}
</ToolCard>
