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
 *   uiStore         — modals & cross-component signals
 */

class FileStore {
  list = $state<string[]>([]);
  total = $state(0);
  refreshing = $state(false);
  uploading = $state(false);
}

export const fileStore = new FileStore();

class SelectionStore {
  cursor = $state(-1);
  selected = $state<Set<number>>(new Set());
  anchor = $state(0);
}

export const selectionStore = new SelectionStore();

class EditStore {
  tags = $state<string[]>([]);
  rating = $state(0);
  busy = $state(false);
}

export const editStore = new EditStore();

class UIStore {
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
  /** Incremented on navigation — signals sidebar scroll & preview zoom reset. */
  navigationTick = $state(0);
  /** Incremented when the tag input should receive focus. */
  focusInputTick = $state(0);
}

export const uiStore = new UIStore();
