import { writable } from "svelte/store";

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let nextId = 0;

const { subscribe, update } = writable<ToastItem[]>([]);

export const toasts = { subscribe };

export function addToast(message: string, type: ToastItem["type"] = "info") {
  const id = nextId++;
  update((items) => [...items, { id, message, type }]);

  setTimeout(() => {
    update((items) => items.filter((t) => t.id !== id));
  }, 3200); // 3000ms visible + 200ms fade
}
