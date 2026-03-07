import { api } from "$lib/client/api.js";
import { getSettingsContext } from "./context.svelte.js";

/**
 * 建立系統維護邏輯的核心工廠函數
 */
export function createSettingsMaintenance() {
  /** Settings 頁面共享的 Context */
  const ctx = getSettingsContext();

  // ─── 孤立檔案 ──────────────────────────────────────

  /** 孤立檔案檢查結果訊息 */
  let orphanResult = $state("");
  /** 孤立檔案列表 */
  let orphanList = $state<string[]>([]);
  /** 是否正在處理孤立檔案 */
  let orphanBusy = $state(false);

  // ─── 缺失檔案 ──────────────────────────────────────

  /** 缺失檔案檢查結果訊息 */
  let missingResult = $state("");
  /** 缺失檔案 ID 列表 */
  let missingList = $state<string[]>([]);
  /** 是否正在處理缺失檔案 */
  let missingBusy = $state(false);

  // ─── 備份 ──────────────────────────────────────────

  /** 備份結果訊息 */
  let backupResult = $state("");
  /** 是否正在備份 */
  let backupBusy = $state(false);

  // ─── 清空垃圾桶 ────────────────────────────────────

  /** 清空垃圾桶結果訊息 */
  let trashResult = $state("");
  /** 是否正在清空垃圾桶 */
  let trashBusy = $state(false);

  // ---

  /** 顯示確認對話框並等待使用者回應 */
  function confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      ctx.pendingConfirm = { message, resolve };
    });
  }

  // ---

  /** 處理「檢查孤立檔案」按鈕點擊事件，掃描並列出孤立檔案 */
  async function handleOrphanCheckClick() {
    orphanBusy = true;
    orphanResult = "";
    orphanList = [];

    const res = await api.get<{ orphans: string[] }>("/api/maintenance/orphans");
    if (res.ok && res.data) {
      orphanList = res.data.orphans;
      orphanResult = orphanList.length === 0 ? "沒有找到孤立檔案" : `找到 ${orphanList.length} 個孤立檔案`;
    } else {
      orphanResult = "錯誤: " + (res.error || "未知");
    }
    orphanBusy = false;
  }

  /** 處理「刪除孤立檔案」按鈕點擊事件，刪除所有孤立檔案 */
  async function handleOrphanDeleteClick() {
    if (!(await confirm(`確定要刪除 ${orphanList.length} 個孤立檔案？此操作無法復原。`))) return;

    orphanBusy = true;
    const res = await api.del<{ deleted: number }>("/api/maintenance/orphans");
    if (res.ok && res.data) {
      orphanResult = `已刪除 ${res.data.deleted} 個孤立檔案`;
      orphanList = [];
    } else {
      orphanResult = "錯誤: " + (res.error || "未知");
    }
    orphanBusy = false;
  }

  // ---

  /** 處理「檢查缺失檔案」按鈕點擊事件，掃描並列出缺失記錄 */
  async function handleMissingCheckClick() {
    missingBusy = true;
    missingResult = "";
    missingList = [];

    const res = await api.get<{ missing: string[] }>("/api/maintenance/missing");
    if (res.ok && res.data) {
      missingList = res.data.missing;
      missingResult = missingList.length === 0 ? "沒有找到缺失記錄" : `找到 ${missingList.length} 個缺失記錄`;
    } else {
      missingResult = "錯誤: " + (res.error || "未知");
    }
    missingBusy = false;
  }

  /** 處理「刪除缺失記錄」按鈕點擊事件，刪除所有缺失記錄 */
  async function handleMissingDeleteClick() {
    if (!(await confirm(`確定要刪除 ${missingList.length} 個缺失記錄？此操作無法復原。`))) return;

    missingBusy = true;
    const res = await api.del<{ deleted: number }>("/api/maintenance/missing");
    if (res.ok && res.data) {
      missingResult = `已刪除 ${res.data.deleted} 個缺失記錄`;
      missingList = [];
    } else {
      missingResult = "錯誤: " + (res.error || "未知");
    }
    missingBusy = false;
  }

  // ---

  /** 處理「資料庫備份」按鈕點擊事件，建立 db.json 的備份副本 */
  async function handleBackupClick() {
    backupBusy = true;
    backupResult = "";

    const res = await api.post<{ backupPath: string }>("/api/maintenance/backup");
    if (res.ok && res.data) {
      backupResult = "備份完成: " + res.data.backupPath;
    } else {
      backupResult = "錯誤: " + (res.error || "未知");
    }
    backupBusy = false;
  }

  // ---

  /** 處理「清空垃圾桶」按鈕點擊事件，永久刪除所有垃圾桶檔案 */
  async function handleEmptyTrashClick() {
    if (!(await confirm("確定要清空垃圾桶？此操作無法復原。"))) return;

    trashBusy = true;
    trashResult = "";

    const res = await api.del<{ deleted: number }>("/api/trash");
    if (res.ok && res.data) {
      trashResult = `已清空垃圾桶，刪除 ${res.data.deleted} 個檔案`;
    } else {
      trashResult = "錯誤: " + (res.error || "未知");
    }
    trashBusy = false;
  }

  // ---

  return {
    /** 存取孤立檔案結果訊息的 getter */
    get orphanResult() {
      return orphanResult;
    },
    /** 存取孤立檔案列表的 getter */
    get orphanList() {
      return orphanList;
    },
    /** 存取孤立檔案處理狀態的 getter */
    get orphanBusy() {
      return orphanBusy;
    },
    /** 存取缺失檔案結果訊息的 getter */
    get missingResult() {
      return missingResult;
    },
    /** 存取缺失檔案列表的 getter */
    get missingList() {
      return missingList;
    },
    /** 存取缺失檔案處理狀態的 getter */
    get missingBusy() {
      return missingBusy;
    },
    /** 存取備份結果訊息的 getter */
    get backupResult() {
      return backupResult;
    },
    /** 存取備份處理狀態的 getter */
    get backupBusy() {
      return backupBusy;
    },
    /** 存取垃圾桶結果訊息的 getter */
    get trashResult() {
      return trashResult;
    },
    /** 存取垃圾桶處理狀態的 getter */
    get trashBusy() {
      return trashBusy;
    },
    /** 處理「檢查孤立檔案」按鈕點擊事件，掃描並列出孤立檔案 */
    handleOrphanCheckClick,
    /** 處理「刪除孤立檔案」按鈕點擊事件，刪除所有孤立檔案 */
    handleOrphanDeleteClick,
    /** 處理「檢查缺失檔案」按鈕點擊事件，掃描並列出缺失記錄 */
    handleMissingCheckClick,
    /** 處理「刪除缺失記錄」按鈕點擊事件，刪除所有缺失記錄 */
    handleMissingDeleteClick,
    /** 處理「資料庫備份」按鈕點擊事件，建立 db.json 的備份副本 */
    handleBackupClick,
    /** 處理「清空垃圾桶」按鈕點擊事件，永久刪除所有垃圾桶檔案 */
    handleEmptyTrashClick,
  };
}
