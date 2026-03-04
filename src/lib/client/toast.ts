/**
 * @file toast.ts
 * Sonner-style toast notification store.
 *
 * Public API (unchanged):
 *   addToast(message, type?, duration?)  — show a toast
 *   dismissToast(id)                     — programmatically dismiss
 *
 * Internal additions for the Sonner-style component:
 *   - `removing` flag triggers CSS exit animation before DOM removal
 *   - `createdAt` / `remaining` support hover-pause behaviour
 *   - `finalizeRemoval(id)` actually removes the item after animation ends
 *   - `pauseAll()` / `resumeAll()` for hover-based timer control
 */

import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  removing: boolean;
  createdAt: number;
  remaining: number;
}

let nextId = 0;

/** Module-scoped timer map: id → setTimeout handle */
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const store = writable<ToastItem[]>([]);

/** Subscribe-only handle. The component reads this. */
export const toasts = { subscribe: store.subscribe };

/**
 * Show a toast notification.
 * @returns The toast id (useful for programmatic dismissal).
 */
export function addToast(message: string, type: ToastType = "info", duration = 3000): number {
  const id = nextId++;
  const now = Date.now();

  store.update((all) => {
    // Prepend so newest is first (index 0 = top)
    const next = [{ id, message, type, duration, removing: false, createdAt: now, remaining: duration }, ...all];
    // Hard cap: auto-dismiss anything beyond MAX_VISIBLE
    const MAX_VISIBLE = 5;
    for (let i = MAX_VISIBLE; i < next.length; i++) {
      if (!next[i].removing) {
        scheduleRemoval(next[i].id, 0);
      }
    }
    return next;
  });

  if (duration > 0) {
    scheduleRemoval(id, duration);
  }

  return id;
}

/** Mark a toast as `removing` — the component plays the exit animation, then calls `finalizeRemoval`. */
export function dismissToast(id: number) {
  clearTimer(id);
  store.update((all) => all.map((t) => (t.id === id ? { ...t, removing: true } : t)));
}

/** Actually remove the item from the store. Called by the component after `transitionend`. */
export function finalizeRemoval(id: number) {
  store.update((all) => all.filter((t) => t.id !== id));
}

/** Pause all auto-dismiss timers (hover). */
export function pauseAll() {
  const now = Date.now();

  // Clear all pending timers first
  for (const [, handle] of timers) clearTimeout(handle);
  timers.clear();

  // Snapshot remaining time for each toast
  store.update((all) =>
    all.map((t) => {
      if (t.removing || t.duration <= 0) return t;
      const elapsed = now - t.createdAt;
      return { ...t, remaining: Math.max(0, t.remaining - elapsed) };
    }),
  );
}

/** Resume auto-dismiss timers after hover ends. */
export function resumeAll() {
  const now = Date.now();
  store.update((all) =>
    all.map((t) => {
      if (t.removing || t.duration <= 0) return t;
      const remaining = t.remaining;
      if (remaining > 0) {
        scheduleRemoval(t.id, remaining);
      }
      return { ...t, createdAt: now, remaining };
    }),
  );
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function scheduleRemoval(id: number, delay: number) {
  clearTimer(id);
  const handle = setTimeout(() => {
    timers.delete(id);
    dismissToast(id);
  }, delay);
  timers.set(id, handle);
}

function clearTimer(id: number) {
  const handle = timers.get(id);
  if (handle !== undefined) {
    clearTimeout(handle);
    timers.delete(id);
  }
}
