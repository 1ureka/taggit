/**
 * @file backup.svelte.ts
 * 將圖片集打包為 ZIP 並下載
 */

import { getContext, setContext } from "svelte";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

class BackupController {
  /** 是否正在備份中 */
  pending = $state(false);

  private download = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    document.body.appendChild(a);

    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  /** 處理下載事件 */
  handleDownload = async () => {
    if (this.pending) return;
    this.pending = true;

    try {
      // 此請求回傳 ZIP 檔案的 Blob，非 JSON，故不透過 $lib/utils/request 統一工具
      const res = await fetch("/api/collection/backup");

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        addToast({ message: `備份失敗：${data?.message ?? "未知錯誤"}`, variant: "error" });
        return;
      }

      const blob = await res.blob();
      await this.download(blob);

      addToast({ message: "備份已下載", variant: "success" });
    } catch (err) {
      addToast({ message: "備份失敗：" + formatError(err), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("backup-controller");

export const createBackupContext = () => {
  const controller = new BackupController();
  setContext(key, controller);
  return controller;
};

export const getBackupContext = () => getContext<BackupController>(key);
