/**
 * @file missing.svelte.ts
 * 缺失檔案記錄檢查與刪除。
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

class MissingController {
  /** 缺失檔案 ID 列表（null 表示尚未檢查） */
  records = $state<string[] | null>(null);
  /** 是否正在檢查或修復中 */
  pending = $state(false);
  /** 檢查結果 */
  result = $derived.by(() => {
    if (this.records === null) return undefined;
    if (this.records.length === 0) return "沒有找到缺失記錄";
    return `找到 ${this.records.length} 個缺失記錄`;
  });

  /** 處理檢查事件 */
  handleCheck = async () => {
    if (this.pending) return;
    this.pending = true;

    try {
      const res = await api.get<{ missing: string[] }>("/api/settings/missing");

      if (!res.ok) {
        addToast({ message: `檢查失敗：${res.error}`, variant: "error" });
        return;
      }

      this.records = res.data.missing;
    } catch (err) {
      addToast({ message: "檢查失敗：" + formatError(err), variant: "error" });
    } finally {
      this.pending = false;
    }
  };

  private navigate = async () => {
    const url = new URL(location.href);
    await goto(url, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true, state: page.state });
  };

  /** 處理修復事件 */
  handleDelete = async () => {
    if (this.records === null || this.pending) return;

    const msg = `確定要刪除 ${this.records.length} 個缺失記錄？此操作無法復原。`;
    const confirmed = await requestConfirm(msg, { title: "刪除記錄", action: "刪除" });
    if (!confirmed) return;

    this.pending = true;
    try {
      const res = await api.del<{ removed: string[] }>("/api/settings/missing");

      if (!res.ok) {
        addToast({ message: `刪除失敗：${res.error}`, variant: "error" });
        return;
      }

      this.records = [];
      addToast({ message: `已刪除 ${res.data.removed.length} 個缺失記錄`, variant: "success" });

      await this.navigate();
    } catch (err) {
      addToast({ message: "刪除失敗：" + formatError(err), variant: "error" });
    } finally {
      this.pending = false;
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
