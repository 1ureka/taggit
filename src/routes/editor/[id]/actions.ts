/**
 * @file actions.ts
 *
 * Business logic for the /editor/[id] edit page.
 *
 * Actions are the ONLY place that mutates stores.
 *
 * Sections:
 *   Init · Tags · Save · Reload · Trash · Confirm · Keyboard
 *
 * Search-page actions live in ../actions.ts.
 */

import { goto } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import { debounce } from "$lib/utils.js";
import type { ImageWithId } from "$lib/types.js";

import { editStore, uiStore } from "./stores.svelte.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const SAVE_DEBOUNCE = 800;

// ═══════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════

/** Hydrate edit stores from SSR data. */
export function initEdit(image: ImageWithId) {
  editStore.image = image;
  editStore.currentTags = [...image.tags];
  editStore.currentRating = image.rating ?? 0;
  editStore.dirty = false;
  editStore.saving = false;
  editStore.lastUpdatedAt = image.updatedAt ?? 0;

  uiStore.pendingConfirm = null;
}

// ═══════════════════════════════════════════════════════════
//  Tags
// ═══════════════════════════════════════════════════════════

export function markDirty() {
  editStore.dirty = true;
}

export function setRating(r: number) {
  editStore.currentRating = r;
  editStore.dirty = true;
}

// ═══════════════════════════════════════════════════════════
//  Save
// ═══════════════════════════════════════════════════════════

export async function saveChanges() {
  const img = editStore.image;
  if (!img || !editStore.dirty || editStore.saving) return;
  editStore.saving = true;
  try {
    const res = await api.patch<ImageWithId>(`/api/images/${img.id}`, {
      tags: editStore.currentTags,
      rating: editStore.currentRating,
      expectedUpdatedAt: editStore.lastUpdatedAt,
    });
    if (!res.ok) {
      if (res.status === 409) {
        addToast("儲存衝突：資料已被其他操作修改，正在重新載入", "error");
        await reloadImage();
      } else {
        addToast("儲存失敗: " + (res.error || "未知錯誤"), "error");
      }
      return;
    }
    if (res.data) {
      editStore.image = res.data;
      editStore.currentTags = [...res.data.tags];
      editStore.currentRating = res.data.rating;
      editStore.lastUpdatedAt = res.data.updatedAt;
    }
    editStore.dirty = false;
    addToast("已儲存", "success");
  } finally {
    editStore.saving = false;
  }
}

export const debouncedSave = debounce(saveChanges, SAVE_DEBOUNCE);

// ═══════════════════════════════════════════════════════════
//  Reload
// ═══════════════════════════════════════════════════════════

export async function reloadImage() {
  const img = editStore.image;
  if (!img) return;
  const res = await api.get<ImageWithId>(`/api/images/${img.id}`);
  if (res.ok && res.data) {
    editStore.image = res.data;
    editStore.currentTags = [...res.data.tags];
    editStore.currentRating = res.data.rating;
    editStore.lastUpdatedAt = res.data.updatedAt;
    editStore.dirty = false;
  }
}

// ═══════════════════════════════════════════════════════════
//  Trash
// ═══════════════════════════════════════════════════════════

export async function trashImage() {
  const img = editStore.image;
  if (!img) return;
  const ok = await confirmDialog("確定要將此圖片移入垃圾桶嗎？");
  if (!ok) return;

  const res = await api.del(`/api/images/${img.id}`);
  if (!res.ok) {
    addToast("操作失敗: " + (res.error || "未知錯誤"), "error");
    return;
  }
  addToast("已移入垃圾桶", "success");
  goto("/editor");
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
//  Keyboard
// ═══════════════════════════════════════════════════════════

export function handleEditKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

  if (e.ctrlKey || e.metaKey) {
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      saveChanges();
    }
    return;
  }

  if (inInput || e.altKey) return;

  if (e.key === "Escape") {
    e.preventDefault();
    goto("/editor");
  }
}
