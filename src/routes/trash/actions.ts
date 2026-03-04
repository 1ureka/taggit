/**
 * @file actions.ts
 *
 * Business logic for the /trash page.
 *
 * Actions are the ONLY place that mutates stores.
 *
 * Sections:
 *   Init · Search · Selection · Restore & Delete · Confirm · Keyboard
 */

import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";

import { trashStore, selectionStore, uiStore } from "./stores.svelte.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const LOADING_DELAY = 200;
const SEARCH_DEBOUNCE = 300;

// ─── Timers (module-scoped) ─────────────────────────────────────────────────

let loadingTimer: ReturnType<typeof setTimeout> | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// ═══════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════

/** Hydrate trash stores from SSR data. */
export function initTrash(files: string[], total: number, page: number, pages: number) {
  trashStore.files = files;
  trashStore.total = total;
  trashStore.page = page;
  trashStore.pages = pages;
  trashStore.searchText = "";
  trashStore.loading = false;
  trashStore.showLoading = false;

  selectionStore.selected = new Set();
}

// ═══════════════════════════════════════════════════════════
//  Search / Fetch
// ═══════════════════════════════════════════════════════════

/** Execute a server query with the current filter state. */
export async function doSearch(resetPage = true) {
  if (resetPage) trashStore.page = 1;
  trashStore.loading = true;

  if (loadingTimer) clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    if (trashStore.loading) trashStore.showLoading = true;
  }, LOADING_DELAY);

  try {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(trashStore.page));
    if (trashStore.searchText.trim()) params.set("search", trashStore.searchText.trim());

    const res = await api.get<{ files: string[]; total: number; page: number; pages: number }>(
      `/api/trash?${params.toString()}`,
    );
    if (res.ok && res.data) {
      trashStore.files = res.data.files;
      trashStore.total = res.data.total;
      trashStore.page = res.data.page;
      trashStore.pages = res.data.pages;
    }
  } finally {
    trashStore.loading = false;
    if (loadingTimer) clearTimeout(loadingTimer);
    trashStore.showLoading = false;
    validateSelection();
  }
}

/** Debounced text search. */
export function handleSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(), SEARCH_DEBOUNCE);
}

/** Navigate to a specific page. */
export function goToPage(p: number) {
  if (p < 1 || p > trashStore.pages) return;
  trashStore.page = p;
  doSearch(false);
}

/**
 * Remove from the selection any filenames that are no longer present
 * in the current result page.
 */
export function validateSelection() {
  if (selectionStore.selected.size === 0) return;
  const visible = new Set(trashStore.files);
  const next = new Set([...selectionStore.selected].filter((f) => visible.has(f)));
  if (next.size !== selectionStore.selected.size) {
    selectionStore.selected = next;
  }
}

// ═══════════════════════════════════════════════════════════
//  Selection
// ═══════════════════════════════════════════════════════════

export function isSelecting(): boolean {
  return selectionStore.selected.size > 0;
}

export function selectAll() {
  selectionStore.selected = new Set(trashStore.files);
}

export function invertSelection() {
  const next = new Set<string>();
  for (const f of trashStore.files) {
    if (!selectionStore.selected.has(f)) next.add(f);
  }
  selectionStore.selected = next;
}

export function toggleSelect(filename: string) {
  const next = new Set(selectionStore.selected);
  if (next.has(filename)) {
    next.delete(filename);
  } else {
    next.add(filename);
  }
  selectionStore.selected = next;
}

export function clearSelection() {
  selectionStore.selected = new Set();
}

export function handleCardClick(filename: string) {
  toggleSelect(filename);
}

// ═══════════════════════════════════════════════════════════
//  Confirm Dialog
// ═══════════════════════════════════════════════════════════

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    uiStore.pendingConfirm = { message, resolve };
  });
}

export function resolveConfirm(value: boolean) {
  uiStore.pendingConfirm?.resolve(value);
  uiStore.pendingConfirm = null;
}

// ═══════════════════════════════════════════════════════════
//  Restore & Delete
// ═══════════════════════════════════════════════════════════

/** Restore selected files back to staged. */
export async function restoreSelected() {
  const filenames = [...selectionStore.selected];
  if (filenames.length === 0) return;

  let successCount = 0;
  let failCount = 0;

  for (const f of filenames) {
    const res = await api.post(`/api/trash/${encodeURIComponent(f)}`);
    if (res.ok) {
      successCount++;
    } else {
      failCount++;
    }
  }

  clearSelection();
  await doSearch(false);

  if (failCount > 0) {
    addToast(`已還原 ${successCount} 張，${failCount} 張失敗`, "error");
  } else {
    addToast(`已還原 ${successCount} 張圖片`, "success");
  }
}

/** Permanently delete selected files. */
export async function deleteSelected() {
  const filenames = [...selectionStore.selected];
  if (filenames.length === 0) return;

  const ok = await confirmDialog(`確定要永久刪除已選取的 ${filenames.length} 張圖片嗎？此操作無法復原。`);
  if (!ok) return;

  let successCount = 0;
  let failCount = 0;

  for (const f of filenames) {
    const res = await api.del(`/api/trash/${encodeURIComponent(f)}`);
    if (res.ok) {
      successCount++;
    } else {
      failCount++;
    }
  }

  clearSelection();
  await doSearch(false);

  if (failCount > 0) {
    addToast(`已刪除 ${successCount} 張，${failCount} 張失敗`, "error");
  } else {
    addToast(`已永久刪除 ${successCount} 張圖片`, "success");
  }
}

/** Restore ALL files in trash (not just selected). */
export async function restoreAll() {
  const ok = await confirmDialog(`確定要還原垃圾桶中的所有圖片嗎？它們會被移回待審查區。`);
  if (!ok) return;

  const res = await api.post<{ restored: number }>("/api/trash");
  if (res.ok) {
    addToast(`已還原 ${res.data?.restored ?? 0} 張圖片`, "success");
  } else {
    addToast("還原失敗: " + (res.error ?? "未知錯誤"), "error");
  }

  clearSelection();
  await doSearch();
}

/** Permanently delete ALL files in trash (not just selected). */
export async function emptyTrash() {
  const ok = await confirmDialog(`確定要清空整個垃圾桶嗎？所有圖片將被永久刪除，此操作無法復原。`);
  if (!ok) return;

  const res = await api.del<{ deleted: number }>("/api/trash");
  if (res.ok) {
    addToast(`已清空垃圾桶 (${res.data?.deleted ?? 0} 張)`, "success");
  } else {
    addToast("清空失敗: " + (res.error ?? "未知錯誤"), "error");
  }

  clearSelection();
  await doSearch();
}

// ═══════════════════════════════════════════════════════════
//  Keyboard
// ═══════════════════════════════════════════════════════════

export function handleTrashKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isSelecting()) {
    e.preventDefault();
    clearSelection();
    return;
  }

  const target = e.target as HTMLElement;
  const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

  if (e.ctrlKey || e.metaKey) {
    if (e.key === "a" || e.key === "A") {
      if (e.shiftKey) {
        e.preventDefault();
        clearSelection();
      } else if (!inInput) {
        e.preventDefault();
        selectAll();
      }
      return;
    }
    if ((e.key === "i" || e.key === "I") && !inInput) {
      e.preventDefault();
      invertSelection();
      return;
    }
  }
}
