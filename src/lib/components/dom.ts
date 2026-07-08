/**
 * @file dom.ts
 * 前端 DOM 工具函式 —— 輸入狀態判斷、捲動控制、Toast 通知與確認對話框。
 */

import type { ConfirmEventName, ConfirmPayload, ToastEventName, ToastPayload, ToastType } from "./types.js";
import type { ToastProgressStartEventName, ToastProgressStartPayload } from "./types.js";
import type { ToastProgressUpdateEventName, ToastProgressUpdatePayload } from "./types.js";
import type { ToastProgressDoneEventName, ToastProgressDonePayload } from "./types.js";

/**
 * 判斷指定元素是否為可編輯的輸入元素（input、textarea 或 contentEditable）。
 * 常用於鍵盤事件處理中，避免在使用者正在輸入時攔截按鍵。
 */
export function isInEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.contentEditable === "true";
}

/**
 * 將指定索引的項目捲動至可視範圍內。
 * 若該項目已在可視區域內，則不做任何操作。
 */
export function scrollToActive(listEl: HTMLElement | null, idx: number, itemH: number): void {
  if (!listEl) return;
  const top = idx * itemH;
  const bottom = top + itemH;
  const viewH = listEl.clientHeight;
  if (top < listEl.scrollTop) {
    listEl.scrollTop = top;
  } else if (bottom > listEl.scrollTop + viewH) {
    listEl.scrollTop = bottom - viewH;
  }
}

/**
 * 顯示一則 toast 通知，內部透過 CustomEvent 將訊息派發至 toast.svelte.ts 的無頭 UI。
 */
export function addToast(message: string, type: ToastType = "info", duration = 3000): void {
  const eventName: ToastEventName = "toast:add";
  window.dispatchEvent(new CustomEvent<ToastPayload>(eventName, { detail: { message, type, duration } }));
}

/**
 * 顯示全域確認對話框並等待使用者回應。
 * 內部透過 CustomEvent 將請求派發至 ConfirmModal 的無頭 UI。
 */
export function requestConfirm(message: string, options?: { title?: string; action?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const eventName: ConfirmEventName = "confirm:request";
    window.dispatchEvent(new CustomEvent<ConfirmPayload>(eventName, { detail: { message, ...options, resolve } }));
  });
}

/**
 * 進度 Toast 的 update 回呼參數
 */
interface ProgressUpdate {
  message: string;
  progress: number;
}

/**
 * 以進度 Toast 包裝一段非同步作業。
 *
 * 建立一個常駐的進度 toast，在 `fn` 執行期間透過 `update` 回呼即時更新訊息與進度條。
 * - `fn` 正常完成 → 自動替換為 success toast。
 * - `fn` 拋出異常 → 自動替換為 error toast。
 *
 * @param label - 初始顯示的 toast 訊息。
 * @param fn - 非同步作業，接收 `update` 回呼。回傳值若包含 `message` 屬性，會作為 success toast 的訊息。
 */
export async function withProgressToast<T>(
  label: string,
  fn: (update: (payload: ProgressUpdate) => void) => Promise<T>,
): Promise<T> {
  const toastId = await new Promise<number>((resolve) => {
    const eventName: ToastProgressStartEventName = "toast:progress:start";
    window.dispatchEvent(
      new CustomEvent<ToastProgressStartPayload>(eventName, { detail: { label, resolveId: resolve } }),
    );
  });

  const update = (payload: ProgressUpdate) => {
    const eventName: ToastProgressUpdateEventName = "toast:progress:update";
    window.dispatchEvent(
      new CustomEvent<ToastProgressUpdatePayload>(eventName, { detail: { id: toastId, ...payload } }),
    );
  };

  try {
    const result = await fn(update);
    const message =
      result && typeof result === "object" && "message" in result && typeof result.message === "string"
        ? result.message
        : "完成";
    const eventName: ToastProgressDoneEventName = "toast:progress:done";
    window.dispatchEvent(
      new CustomEvent<ToastProgressDonePayload>(eventName, {
        detail: { id: toastId, type: "success", message, duration: 4000 },
      }),
    );
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "未知的錯誤";
    const eventName: ToastProgressDoneEventName = "toast:progress:done";
    window.dispatchEvent(
      new CustomEvent<ToastProgressDonePayload>(eventName, {
        detail: { id: toastId, type: "error", message, duration: 5000 },
      }),
    );
    throw e;
  }
}
