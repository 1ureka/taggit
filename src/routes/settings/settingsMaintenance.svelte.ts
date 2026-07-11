import { invalidateAll } from "$app/navigation";
import { api } from "$lib/utils/client.js";
import { requestConfirm } from "$lib/components/dom.js";

/**
 * SettingsMaintenance 的互動邏輯
 */
export class SettingsMaintenance {
  /** 缺失檔案檢查結果訊息 */
  missingResult = $state("");
  /** 缺失檔案 ID 列表 */
  missingList = $state<string[]>([]);
  /** 是否正在處理缺失檔案 */
  missingBusy = $state(false);

  /** 備份結果訊息 */
  backupResult = $state("");
  /** 是否正在備份 */
  backupBusy = $state(false);

  // ---

  /** 處理「檢查缺失檔案」按鈕點擊事件，掃描並列出缺失記錄 */
  handleMissingCheckClick = async () => {
    this.missingBusy = true;
    this.missingResult = "";
    this.missingList = [];

    const res = await api.get<{ missing: string[] }>("/api/settings/missing");
    if (res.ok && res.data) {
      this.missingList = res.data.missing;
      this.missingResult =
        this.missingList.length === 0 ? "沒有找到缺失記錄" : `找到 ${this.missingList.length} 個缺失記錄`;
    } else {
      this.missingResult = "錯誤: " + (res.error || "未知");
    }
    this.missingBusy = false;
  };

  /** 處理「刪除缺失記錄」按鈕點擊事件，刪除所有缺失記錄 */
  handleMissingDeleteClick = async () => {
    const msg = `確定要刪除 ${this.missingList.length} 個缺失記錄？此操作無法復原。`;
    if (!(await requestConfirm(msg, { title: "刪除記錄", action: "刪除" }))) return;

    this.missingBusy = true;
    const res = await api.del<{ removed: string[] }>("/api/settings/missing");
    if (res.ok && res.data) {
      this.missingResult = `已刪除 ${res.data.removed.length} 個缺失記錄`;
      this.missingList = [];
      await invalidateAll();
    } else {
      this.missingResult = "錯誤: " + (res.error || "未知");
    }
    this.missingBusy = false;
  };

  // ---

  /** 處理「備份」按鈕點擊事件，下載 ZIP 備份檔 */
  handleBackupClick = async () => {
    this.backupBusy = true;
    this.backupResult = "";
    try {
      const res = await fetch("/api/settings/backup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        this.backupResult = "錯誤: " + (data.error || "未知");
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
      this.backupResult = "備份已下載";
    } catch {
      this.backupResult = "備份失敗";
    } finally {
      this.backupBusy = false;
    }
  };
}
