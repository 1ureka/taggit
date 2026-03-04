import { writable } from "svelte/store";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  duration: number;
}

let nextId = 0;

const { subscribe, update } = writable<ToastItem[]>([]);

export const toasts = { subscribe };

export function addToast(message: string, type: ToastItem["type"] = "info", duration = 3000) {
  const id = nextId++;
  update((items) => [...items, { id, message, type, duration }]);
  setTimeout(() => dismissToast(id), duration + 200);
}

export function dismissToast(id: number) {
  update((items) => items.filter((t) => t.id !== id));
}
