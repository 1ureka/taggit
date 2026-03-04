/**
 * @file stores.svelte.ts
 *
 * Pure data stores for the Tagger page.
 * Each store holds only reactive state — no logic, no side-effects.
 * All mutations happen exclusively through actions (see actions.ts).
 *
 * Stores:
 *   fileStore       — staged file list & progress tracking
 *   selectionStore  — cursor position & multi-select
 *   editStore       — current tagging session (tags, rating, busy)
 *   tagCatalogStore — all known tags (autocomplete source)
 *   uiStore         — modals & cross-component signals
 *   toolStore       — maintenance tool results
 */

import type { TagInfo } from "$lib/types.js";

// ═══════════════════════════════════════════════════════════
//  File Store
// ═══════════════════════════════════════════════════════════

class FileStore {
  list = $state<string[]>([]);
  total = $state(0);
  refreshing = $state(false);
  uploading = $state(false);
}

export const fileStore = new FileStore();

// ═══════════════════════════════════════════════════════════
//  Selection Store
// ═══════════════════════════════════════════════════════════

class SelectionStore {
  cursor = $state(-1);
  selected = $state<Set<number>>(new Set());
  anchor = $state(0);
}

export const selectionStore = new SelectionStore();

// ═══════════════════════════════════════════════════════════
//  Edit Store
// ═══════════════════════════════════════════════════════════

class EditStore {
  tags = $state<string[]>([]);
  rating = $state(0);
  busy = $state(false);
}

export const editStore = new EditStore();

// ═══════════════════════════════════════════════════════════
//  Tag Catalog Store
// ═══════════════════════════════════════════════════════════

class TagCatalogStore {
  known = $state<TagInfo[]>([]);
}

export const tagCatalogStore = new TagCatalogStore();

// ═══════════════════════════════════════════════════════════
//  UI Store
// ═══════════════════════════════════════════════════════════

class UIStore {
  toolsOpen = $state(false);
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
  /** Incremented on navigation — signals sidebar scroll & preview zoom reset. */
  navigationTick = $state(0);
  /** Incremented when the tag input should receive focus. */
  focusInputTick = $state(0);
}

export const uiStore = new UIStore();

// ═══════════════════════════════════════════════════════════
//  Tool Store
// ═══════════════════════════════════════════════════════════

class ToolStore {
  result = $state("");
  showRename = $state(false);
}

export const toolStore = new ToolStore();
