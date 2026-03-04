/**
 * @file stores.svelte.ts
 *
 * Pure data stores for the /trash page.
 * Each store holds only reactive state — no logic, no side-effects.
 * All mutations happen exclusively through actions (see actions.ts).
 */

// ═══════════════════════════════════════════════════════════
//  Trash Store
// ═══════════════════════════════════════════════════════════

class TrashStore {
  files = $state<string[]>([]);
  total = $state(0);
  page = $state(1);
  pages = $state(1);
  searchText = $state("");
  loading = $state(false);
  showLoading = $state(false);
}

export const trashStore = new TrashStore();

// ═══════════════════════════════════════════════════════════
//  Selection Store
// ═══════════════════════════════════════════════════════════

class SelectionStore {
  selected = $state<Set<string>>(new Set());
}

export const selectionStore = new SelectionStore();

// ═══════════════════════════════════════════════════════════
//  UI Store
// ═══════════════════════════════════════════════════════════

class UIStore {
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
}

export const uiStore = new UIStore();
