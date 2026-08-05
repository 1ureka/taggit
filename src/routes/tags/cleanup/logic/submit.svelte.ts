/**
 * @file submit.svelte.ts
 * 把指定標籤目前排入的清理操作送出，成功的自排程移除、失敗的匯總回報
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { getScheduleContext, type CleanupOperation } from "./schedule.svelte";

/** TODO: 端點把刪除／合併／隱藏三件事塞進同一組請求，轉正時應拆開 */
type TagsBatchPayload = {
  deletes: string[];
  renames: { from: string; to: string }[];
  hidden: { name: string; hidden: boolean }[];
};

/** 由操作清單組出端點要的請求內容 */
function toPayload(ops: readonly CleanupOperation[]): TagsBatchPayload {
  const payload: TagsBatchPayload = { deletes: [], renames: [], hidden: [] };

  for (const op of ops) {
    if (op.kind === "merge") payload.renames.push({ from: op.name, to: op.to });
    else if (op.kind === "delete") payload.deletes.push(op.name);
    // 清理工具只排「隱藏」，不排「取消隱藏」
    else payload.hidden.push({ name: op.name, hidden: true });
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

      // TODO: 回傳的 `key` 是裸標籤名，能對回請求是靠操作清單的 name 唯一性，
      //       端點自己並不知道也沒有驗證；`/api/proto` 轉正時應回三個各自獨立的結果集
      const res = await api.post<{ results: { key: string; ok: boolean; error?: string }[] }>(
        "/api/proto/tags-batch",
        toPayload(ops),
      );
      if (!res.ok) throw new Error(res.error);

      const failures = new Map<string, string>();
      for (const r of res.data.results) if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
      this.lastFailures = Object.fromEntries(failures);

      const succeeded = names.filter((n) => !failures.has(n));
      for (const n of succeeded) this.schedule.handleUndo(n);

      if (succeeded.length > 0) addToast({ message: `已套用 ${succeeded.length} 筆標籤操作`, variant: "success" });
      if (failures.size > 0) addToast({ message: `${failures.size} 筆操作失敗`, variant: "error" });

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
