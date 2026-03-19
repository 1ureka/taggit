import type { ConfirmEventName, ConfirmPayload, ToastEventName, ToastPayload, ToastType } from "$lib/types.js";

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
export function requestConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const eventName: ConfirmEventName = "confirm:request";
    window.dispatchEvent(new CustomEvent<ConfirmPayload>(eventName, { detail: { message, resolve } }));
  });
}
