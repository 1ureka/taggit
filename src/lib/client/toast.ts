/**
 * @file toast.ts
 * Toast 通知的公開 API。
 *
 * 外部消費者只需 import { addToast }。
 * 內部透過 CustomEvent 將訊息派發至 toast.svelte.ts 的無頭 UI。
 */

import type { ToastEventName, ToastPayload, ToastType } from "$lib/types";

/**
 * 顯示一則 toast 通知，內部透過 CustomEvent 將訊息派發至 toast.svelte.ts 的無頭 UI。
 */
export function addToast(message: string, type: ToastType = "info", duration = 3000): void {
  const eventName: ToastEventName = "toast:add";
  window.dispatchEvent(new CustomEvent<ToastPayload>(eventName, { detail: { message, type, duration } }));
}
