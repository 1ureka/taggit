/**
 * @file backup.svelte.ts
 * 將圖片集打包為 ZIP 並下載
 */

import { getContext, setContext } from "svelte";
import { addToast } from "$lib/components/floating/toast-events";

class BackupController {
  busy = $state(false);

  handleDownload = async () => {
    if (this.busy) return;
    this.busy = true;

    try {
      const res = await fetch("/api/settings/backup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        addToast({ message: `備份失敗：${data?.error ?? "未知錯誤"}`, variant: "error" });
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
      this.busy = false;
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
