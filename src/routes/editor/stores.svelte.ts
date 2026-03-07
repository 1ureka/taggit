/**
 * @file stores.svelte.ts
 *
 * Pure data stores for the /editor search page.
 * Each store holds only reactive state — no logic, no side-effects.
 * All mutations happen exclusively through actions (see actions.ts).
 *
 * Stores:
 *   searchStore     — search / filter / pagination
 *   selectionStore  — multi-select image IDs
 *   uiStore         — modals & cross-component signals
 *
 * Edit-page stores live in [id]/stores.svelte.ts.
 */

import type { ImageWithId } from "$lib/types.js";

// ═══════════════════════════════════════════════════════════
//  Search Store
// ═══════════════════════════════════════════════════════════

class SearchStore {
  items = $state<ImageWithId[]>([]);
  total = $state(0);
  page = $state(1);
  pages = $state(1);
  searchText = $state("");
  selectedTags = $state<string[]>([]);
  rating = $state<number | undefined>(undefined);
  ratingOp = $state<"gte" | "lte" | "eq">("gte");
  sort = $state("committedAt");
  order = $state("desc");
  loading = $state(false);
  showLoading = $state(false);
}

export const searchStore = new SearchStore();

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
