/**
 * @file missing.svelte.ts
 * 缺失檔案記錄檢查 + 刪除。
 * checking/deleting 拆成獨立忙碌旗標；刪除確認框開啟期間與刪除進行中都鎖定「開始檢查」，
 * 避免確認訊息所依據的數量跟實際刪除時的 records 不一致。
 */

import { getContext, setContext } from "svelte";
import { page } from "$app/state";
import { goto } from "$app/navigation";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/widgets/confirm-events";

class MissingController {
  /** 缺失檔案 ID 列表（null 表示尚未檢查） */
  records = $state<string[] | null>(null);
  checking = $state(false);
  deleting = $state(false);
  /** 刪除確認框開啟中 */
  private confirming = $state(false);

  /** 確認框開啟中或刪除進行中時，鎖定「開始檢查」 */
  checkLocked = $derived(this.confirming || this.deleting);

  result = $derived.by(() => {
    if (this.records === null) return undefined;
    if (this.records.length === 0) return "沒有找到缺失記錄";
    return `找到 ${this.records.length} 個缺失記錄`;
  });

  handleCheck = async () => {
    if (this.checking || this.checkLocked) return;
    this.checking = true;

    try {
      const res = await api.get<{ missing: string[] }>("/api/settings/missing");
      if (res.ok && res.data) {
        this.records = res.data.missing;
      } else {
        addToast({ message: `檢查失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
      }
    } catch (err) {
      addToast({ message: "檢查失敗" + (err instanceof Error ? `：${err.message}` : ""), variant: "error" });
    } finally {
      this.checking = false;
    }
  };

  handleDelete = async () => {
    if (this.records === null || this.deleting || this.confirming) return;

    this.confirming = true;
    const msg = `確定要刪除 ${this.records.length} 個缺失記錄？此操作無法復原。`;
    const confirmed = await requestConfirm(msg, { title: "刪除記錄", action: "刪除" });
    this.confirming = false;
    if (!confirmed) return;

    this.deleting = true;
    try {
      const res = await api.del<{ removed: string[] }>("/api/settings/missing");
      if (res.ok && res.data) {
        addToast({ message: `已刪除 ${res.data.removed.length} 個缺失記錄`, variant: "success" });
        this.records = [];
        await goto(location.href, {
          replaceState: true,
          noScroll: true,
          keepFocus: true,
          invalidateAll: true,
          state: page.state,
        });
      } else {
        addToast({ message: `刪除失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
      }
    } catch (err) {
      addToast({ message: "刪除失敗" + (err instanceof Error ? `：${err.message}` : ""), variant: "error" });
    } finally {
      this.deleting = false;
    }
  };
}

const key = Symbol("missing-controller");

export const createMissingContext = () => {
  const controller = new MissingController();
  setContext(key, controller);
  return controller;
};

export const getMissingContext = () => getContext<MissingController>(key);
