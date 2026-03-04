/**
 * @file toast.ts
 * Lightweight toast notification store.
 *
 * Public API:
 *   addToast(message, type?, duration?)  — show a toast
 *   dismissToast(id)                     — programmatically dismiss
 */

import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

let nextId = 0;

const store = writable<ToastItem[]>([]);

/** Subscribe-only handle. The component reads this. */
export const toasts = { subscribe: store.subscribe };

/**
 * Show a toast notification.
 * @returns The toast id (useful for programmatic dismissal).
 */
export function addToast(message: string, type: ToastType = "info", duration = 3000): number {
  const id = nextId++;
  store.update((all) => [...all, { id, message, type, duration }]);
  if (duration > 0) setTimeout(() => dismissToast(id), duration);
  return id;
}

/** Remove a toast immediately (triggers the out-transition in the component). */
export function dismissToast(id: number) {
  store.update((all) => all.filter((t) => t.id !== id));
}
