/**
 * @file submit.svelte.ts
 * 把指定標籤目前排入的清理操作送出，成功的自排程移除、失敗的匯總回報
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { api, type BatchResults } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { getScheduleContext, type CleanupOperation } from "./schedule.svelte";

/**
 * 由操作清單組出端點要的請求內容：以標籤名為鍵，`null` 是刪除。
 * 執行順序（刪除 → 改名 → 顯隱）與集合層衝突檢查都在後端，前端只描述「要變成什麼」。
 */
function toPayload(ops: readonly CleanupOperation[]): Record<string, { name: string } | { hidden: boolean } | null> {
  const payload: Record<string, { name: string } | { hidden: boolean } | null> = {};

  for (const op of ops) {
    if (op.kind === "merge") payload[op.name] = { name: op.to };
    else if (op.kind === "delete") payload[op.name] = null;
    // 清理工具只排「隱藏」，不排「取消隱藏」
    else payload[op.name] = { hidden: true };
  }

  return payload;
}

class SubmitController {
  private schedule = getScheduleContext();

  /** 是否有一次送出正在進行中 */
  pending = $state(false);
  /** 上一次送出後的失敗匯總（name -> 原因） */
  lastFailures = $state<Record<string, string>>({});

  /** 清掉上一輪的失敗匯總 */
  clearFailures = () => {
    this.lastFailures = {};
  };

  /** 送出指定標籤目前排入的操作 */
  handleSubmit = async (names: string[]) => {
    if (names.length === 0 || this.pending) return;

    this.pending = true;
    try {
      const wanted = new Set(names);
      const ops = this.schedule.operations.filter((op) => wanted.has(op.name));

      const res = await api.patch<BatchResults>("/api/tags", toPayload(ops));
      if (!res.ok) throw new Error(res.error);

      const failures: Record<string, string> = {};
      for (const [name, r] of Object.entries(res.data)) if (!r.ok) failures[name] = r.message;
      this.lastFailures = failures;

      const failedCount = Object.keys(failures).length;
      const succeeded = names.filter((n) => !(n in failures));
      for (const n of succeeded) this.schedule.handleUndo(n);

      if (succeeded.length > 0) addToast({ message: `已套用 ${succeeded.length} 筆標籤操作`, variant: "success" });
      if (failedCount > 0) addToast({ message: `${failedCount} 筆操作失敗`, variant: "error" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("submit-controller");

export const createSubmitContext = () => {
  const controller = new SubmitController();
  setContext(key, controller);
  return controller;
};

export const getSubmitContext = () => getContext<SubmitController>(key);
