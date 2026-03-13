import { api } from "$lib/client/api.js";
import { requestConfirm } from "$lib/client/dom.js";

/**
 * SettingsMaintenance 的互動邏輯
 */
export class SettingsMaintenance {
  /** 孤立檔案檢查結果訊息 */
  orphanResult = $state("");
  /** 孤立檔案列表 */
  orphanList = $state<string[]>([]);
  /** 是否正在處理孤立檔案 */
  orphanBusy = $state(false);

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

  /** 清空垃圾桶結果訊息 */
  trashResult = $state("");
  /** 是否正在清空垃圾桶 */
  trashBusy = $state(false);

  // ---

  /** 處理「檢查孤立檔案」按鈕點擊事件，掃描並列出孤立檔案 */
  handleOrphanCheckClick = async () => {
    this.orphanBusy = true;
    this.orphanResult = "";
    this.orphanList = [];

    const res = await api.get<{ orphans: string[] }>("/api/maintenance/orphans");
    if (res.ok && res.data) {
      this.orphanList = res.data.orphans;
      this.orphanResult =
        this.orphanList.length === 0 ? "沒有找到孤立檔案" : `找到 ${this.orphanList.length} 個孤立檔案`;
    } else {
      this.orphanResult = "錯誤: " + (res.error || "未知");
    }
    this.orphanBusy = false;
  };

  /** 處理「刪除孤立檔案」按鈕點擊事件，刪除所有孤立檔案 */
  handleOrphanDeleteClick = async () => {
    if (!(await requestConfirm(`確定要刪除 ${this.orphanList.length} 個孤立檔案？此操作無法復原。`))) return;

    this.orphanBusy = true;
    const res = await api.del<{ deleted: number }>("/api/maintenance/orphans");
    if (res.ok && res.data) {
      this.orphanResult = `已刪除 ${res.data.deleted} 個孤立檔案`;
      this.orphanList = [];
    } else {
      this.orphanResult = "錯誤: " + (res.error || "未知");
    }
    this.orphanBusy = false;
  };

  // ---

  /** 處理「檢查缺失檔案」按鈕點擊事件，掃描並列出缺失記錄 */
  handleMissingCheckClick = async () => {
    this.missingBusy = true;
    this.missingResult = "";
    this.missingList = [];

    const res = await api.get<{ missing: string[] }>("/api/maintenance/missing");
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
    if (!(await requestConfirm(`確定要刪除 ${this.missingList.length} 個缺失記錄？此操作無法復原。`))) return;

    this.missingBusy = true;
    const res = await api.del<{ deleted: number }>("/api/maintenance/missing");
    if (res.ok && res.data) {
      this.missingResult = `已刪除 ${res.data.deleted} 個缺失記錄`;
      this.missingList = [];
    } else {
      this.missingResult = "錯誤: " + (res.error || "未知");
    }
    this.missingBusy = false;
  };

  // ---

  /** 處理「資料庫備份」按鈕點擊事件，建立 db.json 的備份副本 */
  handleBackupClick = async () => {
    this.backupBusy = true;
    this.backupResult = "";

    const res = await api.post<{ backupPath: string }>("/api/maintenance/backup");
    if (res.ok && res.data) {
      this.backupResult = "備份完成: " + res.data.backupPath;
    } else {
      this.backupResult = "錯誤: " + (res.error || "未知");
    }
    this.backupBusy = false;
  };

  // ---

  /** 處理「清空垃圾桶」按鈕點擊事件，永久刪除所有垃圾桶檔案 */
  handleEmptyTrashClick = async () => {
    if (!(await requestConfirm("確定要清空垃圾桶？此操作無法復原。"))) return;

    this.trashBusy = true;
    this.trashResult = "";

    const res = await api.del<{ deleted: number }>("/api/trash");
    if (res.ok && res.data) {
      this.trashResult = `已清空垃圾桶，刪除 ${res.data.deleted} 個檔案`;
    } else {
      this.trashResult = "錯誤: " + (res.error || "未知");
    }
    this.trashBusy = false;
  };
}
