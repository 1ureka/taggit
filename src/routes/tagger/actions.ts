/**
 * @file actions.ts
 *
 * All business logic for the Tagger page.
 *
 * Actions are the ONLY place that mutates stores.
 * Each function reads from one or more stores, performs
 * computation / async work, then writes back to stores.
 *
 * Components call these directly — no props, no callbacks.
 *
 * Sections:
 *   Init · Navigation · Tag Editing · Commit & Trash ·
 *   File Operations · Confirm Dialog ·
 *   Tools · Keyboard
 */

import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import { tagCache } from "$lib/client/cache.js";
import { fileStore, selectionStore, editStore, uiStore } from "./stores.svelte.js";
import { stagedUrl, imageDimensions, batchRun } from "./helpers.js";

// ─── Internal helpers (not exported) ─────────────────────────────────────────

function selectedFilenames(): string[] {
  return [...selectionStore.selected].sort((a, b) => a - b).map((i) => fileStore.list[i]);
}

function removeByNames(names: string[]) {
  const nameSet = new Set(names);
  fileStore.list = fileStore.list.filter((f) => !nameSet.has(f));
  selectionStore.selected = new Set();

  if (fileStore.list.length === 0) {
    selectionStore.cursor = -1;
  } else {
    select(Math.min(selectionStore.cursor, fileStore.list.length - 1));
  }
}

// ═══════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════

/** Reset all stores and load initial data from the server. */
export function initTagger(files: string[]) {
  // File store
  fileStore.list = [...files];
  fileStore.total = files.length;
  fileStore.refreshing = false;
  fileStore.uploading = false;

  // Selection store
  selectionStore.cursor = -1;
  selectionStore.selected = new Set();
  selectionStore.anchor = 0;

  // Edit store
  editStore.tags = [];
  editStore.rating = 0;
  editStore.busy = false;

  // UI store
  uiStore.pendingConfirm = null;
  uiStore.navigationTick = 0;
  uiStore.focusInputTick = 0;

  // Auto-select first image
  if (files.length > 0) select(0);
}

// ═══════════════════════════════════════════════════════════
//  Navigation
// ═══════════════════════════════════════════════════════════

/** Move cursor to `idx` with optional multi-select mode. */
export function select(idx: number, mode: "single" | "ctrl" | "shift" = "single") {
  if (idx < 0 || idx >= fileStore.list.length) return;

  if (mode === "single") {
    selectionStore.cursor = idx;
    selectionStore.selected = new Set([idx]);
    selectionStore.anchor = idx;
    editStore.tags = [];
    editStore.rating = 0;
  } else if (mode === "ctrl") {
    const next = new Set(selectionStore.selected);
    next.has(idx) && next.size > 1 ? next.delete(idx) : next.add(idx);
    selectionStore.cursor = idx;
    selectionStore.selected = next;
    selectionStore.anchor = idx;
  } else {
    const lo = Math.min(selectionStore.anchor, idx);
    const hi = Math.max(selectionStore.anchor, idx);
    const next = new Set<number>();
    for (let i = lo; i <= hi; i++) next.add(i);
    selectionStore.cursor = idx;
    selectionStore.selected = next;
  }

  uiStore.navigationTick++;
}

/** Navigate by offset (−1 = prev, +1 = next). */
export function navigate(delta: -1 | 1) {
  const next = selectionStore.cursor + delta;
  if (next >= 0 && next < fileStore.list.length) select(next);
}

// ═══════════════════════════════════════════════════════════
//  Tag Editing
// ═══════════════════════════════════════════════════════════

export function addTag(raw: string) {
  const tag = raw.trim().toLowerCase();
  if (!tag) return;
  if (editStore.tags.includes(tag)) {
    addToast("標籤已存在", "info");
    return;
  }
  editStore.tags = [...editStore.tags, tag];
}

export function removeTag(tag: string) {
  editStore.tags = editStore.tags.filter((t) => t !== tag);
}

export function popTag() {
  if (editStore.tags.length) editStore.tags = editStore.tags.slice(0, -1);
}

export function toggleRating(n: number) {
  editStore.rating = n === editStore.rating ? 0 : n;
}

// ═══════════════════════════════════════════════════════════
//  Commit & Trash
// ═══════════════════════════════════════════════════════════

/** Commit selected images with current tags & rating. */
export async function commit() {
  if (editStore.busy || selectionStore.selected.size === 0 || selectionStore.cursor < 0) return;
  if (editStore.tags.length === 0) {
    addToast("請至少加入一個標籤才能提交", "error");
    return;
  }

  editStore.busy = true;
  const names = selectedFilenames();

  try {
    const [ok, fail] = await batchRun(names, 5, async (fn) => {
      const dims = await imageDimensions(stagedUrl(fn));
      return api.post(`/api/staged/${encodeURIComponent(fn)}`, {
        tags: editStore.tags,
        rating: editStore.rating,
        ...dims,
      });
    });

    if (ok) {
      addToast(ok === 1 ? `已提交: ${names[0]}` : `已提交 ${ok} 張圖片`, "success");
    }
    if (fail) addToast(`${fail} 張提交失敗`, "error");

    removeByNames(names);
    tagCache.invalidate();
  } finally {
    editStore.busy = false;
  }
}

/** Move selected images to trash. */
export async function trash() {
  if (selectionStore.selected.size === 0 || selectionStore.cursor < 0) {
    addToast("沒有選取任何圖片", "info");
    return;
  }

  const n = selectionStore.selected.size;
  const msg =
    n === 1
      ? `確定要將「${fileStore.list[selectionStore.cursor]}」移至垃圾桶？`
      : `確定要將選取的 ${n} 張圖片移至垃圾桶？`;
  if (!(await confirm(msg))) return;

  const names = selectedFilenames();
  const [ok, fail] = await batchRun(names, 5, (fn) => api.del(`/api/staged/${encodeURIComponent(fn)}`));

  if (ok) {
    addToast(ok === 1 ? `已移至垃圾桶: ${names[0]}` : `已將 ${ok} 張圖片移至垃圾桶`, "info");
  }
  if (fail) addToast(`${fail} 張刪除失敗`, "error");

  removeByNames(names);
}

// ═══════════════════════════════════════════════════════════
//  File Operations
// ═══════════════════════════════════════════════════════════

/** Re-scan the staged folder for new files. */
export async function refresh() {
  fileStore.refreshing = true;
  try {
    const res = await api.get<{ files: string[] }>("/api/staged");
    if (!res.ok || !res.data) return;

    const oldLen = fileStore.list.length;
    fileStore.list = res.data.files;
    selectionStore.selected = new Set();

    if (fileStore.list.length === 0) {
      selectionStore.cursor = -1;
    } else if (selectionStore.cursor >= fileStore.list.length) {
      select(fileStore.list.length - 1);
    } else if (oldLen === 0) {
      select(0);
    } else {
      select(selectionStore.cursor);
    }

    const diff = fileStore.list.length - oldLen;
    if (diff > 0) {
      fileStore.total = fileStore.total === 0 ? fileStore.list.length : fileStore.total + diff;
      addToast(`發現 ${diff} 張新圖片`, "success");
    } else if (diff === 0) {
      addToast("沒有發現新圖片", "info");
    } else {
      addToast(`列表已更新（減少 ${-diff} 張）`, "info");
    }
  } finally {
    fileStore.refreshing = false;
  }
}

/** Upload files to the staged folder. */
export async function uploadFiles(files: FileList) {
  fileStore.uploading = true;
  try {
    const body = new FormData();
    for (const f of files) body.append("files", f);

    const res = await fetch("/api/staged", { method: "POST", body });
    const json = await res.json();

    if (json.ok && json.data) {
      const { added, errors } = json.data as { added: string[]; errors: string[] };
      if (added.length) {
        addToast(`已加入 ${added.length} 張圖片`, "success");
        await refresh();
      }
      if (errors.length) addToast(`${errors.length} 個檔案失敗`, "error");
    } else {
      addToast(json.error || "上傳失敗", "error");
    }
  } catch {
    addToast("上傳請求失敗", "error");
  } finally {
    fileStore.uploading = false;
  }
}

// ═══════════════════════════════════════════════════════════
//  Confirm Dialog
// ═══════════════════════════════════════════════════════════

/** Show a confirmation dialog and await the user's response. */
export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    uiStore.pendingConfirm = { message, resolve };
  });
}

/** Resolve the pending confirmation dialog. */
export function resolveConfirm(accepted: boolean) {
  uiStore.pendingConfirm?.resolve(accepted);
  uiStore.pendingConfirm = null;
}

// ═══════════════════════════════════════════════════════════
//  Keyboard
// ═══════════════════════════════════════════════════════════

/** Global keyboard handler — attach to <svelte:window>. */
export function handleKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.contentEditable === "true") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const { key } = e;

  // Rating: 0–5
  if (key >= "0" && key <= "5") {
    e.preventDefault();
    toggleRating(parseInt(key));
    return;
  }

  const actions: Record<string, () => void> = {
    ArrowLeft: () => navigate(-1),
    ArrowRight: () => navigate(1),
    t: () => {
      uiStore.focusInputTick++;
    },
    T: () => {
      uiStore.focusInputTick++;
    },
    Enter: () => commit(),
    Delete: () => trash(),
  };

  const action = actions[key];
  if (action) {
    e.preventDefault();
    action();
  }
}
