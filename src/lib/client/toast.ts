/**
 * @file toast.ts
 * Toast 通知的公開 API。
 *
 * 外部消費者只需 import { addToast }。
 * 內部透過 CustomEvent 將訊息派發至 toast.svelte.ts 的無頭 UI。
 */

/** Toast 類型 */
export type ToastType = "success" | "error" | "info";

/** CustomEvent 攜帶的資料 */
export interface ToastPayload {
  message: string;
  type: ToastType;
  duration: number;
}

/** 事件名稱常數 */
export const TOAST_EVENT = "toast:add";

/** 顯示一則 toast 通知 */
export function addToast(message: string, type: ToastType = "info", duration = 3000): void {
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: { message, type, duration } }));
}
