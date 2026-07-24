/**
 * @file backup.svelte.ts
 * 將圖片集打包為 ZIP 並下載
 */

import { getContext, setContext } from "svelte";
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
      // TODO: 改成統一的 $lib/utils/request
      const res = await fetch("/api/settings/backup", { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // TODO: 修復 $lib/utils/request 而不是這裡
        addToast({ message: `備份失敗：${data?.error ?? "未知錯誤"}`, variant: "error" });
        return;
      }

      const blob = await res.blob();
      await this.download(blob);

      addToast({ message: "備份已下載", variant: "success" });
    } catch {
      // TODO: 使用 formatError 印出更詳細的訊息
      addToast({ message: "備份失敗", variant: "error" });
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
