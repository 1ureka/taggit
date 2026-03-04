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
 *   File Operations · Tag Catalog · Confirm Dialog ·
 *   Tools · Keyboard
 */

import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import type { TagInfo } from "$lib/types.js";

import { fileStore, selectionStore, editStore, tagCatalogStore, uiStore, toolStore } from "./stores.svelte.js";

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
export function initTagger(files: string[], tags: TagInfo[]) {
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

  // Tag catalog
  tagCatalogStore.known = [...tags];

  // UI store
  uiStore.toolsOpen = false;
  uiStore.pendingConfirm = null;
  uiStore.navigationTick = 0;
  uiStore.focusInputTick = 0;

  // Tool store
  toolStore.result = "";
  toolStore.showRename = false;

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
    refreshKnownTags();
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
//  Tag Catalog
// ═══════════════════════════════════════════════════════════

/** Refresh the known-tags catalog from the server. */
export async function refreshKnownTags() {
  const res = await api.get<{ tags: TagInfo[] }>("/api/metadata/tags");
  if (res.ok && res.data) tagCatalogStore.known = res.data.tags;
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
//  Tools
// ═══════════════════════════════════════════════════════════

export function openTools() {
  uiStore.toolsOpen = true;
  toolStore.result = "";
}

export function closeTools() {
  uiStore.toolsOpen = false;
}

export function openRenameModal() {
  toolStore.showRename = true;
}

export function closeRenameModal() {
  toolStore.showRename = false;
}

export async function checkOrphans() {
  toolStore.result = "檢查中...";
  const res = await api.get<{ orphans: string[] }>("/api/maintenance/orphans");
  if (res.ok && res.data) {
    const { orphans } = res.data;
    toolStore.result =
      orphans.length === 0
        ? "✓ 沒有找到孤立檔案"
        : `找到 ${orphans.length} 個孤立檔案:\n${orphans.map((f) => "  • " + f).join("\n")}`;
  } else {
    toolStore.result = "錯誤: " + (res.error || "未知");
  }
}

export async function checkMissing() {
  toolStore.result = "檢查中...";
  const res = await api.get<{ missing: string[] }>("/api/maintenance/missing");
  if (res.ok && res.data) {
    const { missing } = res.data;
    toolStore.result =
      missing.length === 0
        ? "✓ 沒有找到缺失檔案"
        : `找到 ${missing.length} 個缺失記錄:\n${missing.map((m) => "  • " + m).join("\n")}`;
  } else {
    toolStore.result = "錯誤: " + (res.error || "未知");
  }
}

export async function renameTag(oldName: string, newName: string) {
  toolStore.result = "重命名中...";
  const res = await api.post<{ affected: number }>("/api/metadata/tags", { oldName, newName });
  if (res.ok && res.data) {
    toolStore.result = `✓ 已將「${oldName}」重命名為「${newName}」，影響 ${res.data.affected} 張圖片`;
    refreshKnownTags();
  } else {
    toolStore.result = "錯誤: " + (res.error || "未知");
  }
}

export async function backup() {
  toolStore.result = "備份中...";
  const res = await api.post<{ backupPath: string }>("/api/maintenance/backup");
  if (res.ok && res.data) {
    toolStore.result = "✓ 備份完成: " + res.data.backupPath;
  } else {
    toolStore.result = "錯誤: " + (res.error || "未知");
  }
}

export async function emptyTrash() {
  if (!(await confirm("確定要清空垃圾桶？此操作無法復原。"))) return;
  toolStore.result = "清空中...";
  const res = await api.del<{ deleted: number }>("/api/trash");
  if (res.ok && res.data) {
    toolStore.result = `✓ 已清空垃圾桶，刪除 ${res.data.deleted} 個檔案`;
  } else {
    toolStore.result = "錯誤: " + (res.error || "未知");
  }
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
    Escape: () => {
      if (uiStore.toolsOpen) uiStore.toolsOpen = false;
    },
  };

  const action = actions[key];
  if (action) {
    e.preventDefault();
    action();
  }
}
