/**
 * @file actions.ts
 *
 * Business logic for the /editor search page.
 *
 * Actions are the ONLY place that mutates stores.
 *
 * Sections:
 *   Init · Search · Selection · Keyboard
 *
 * Edit-page actions live in [id]/actions.ts.
 */

import { goto } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import type { ImageWithId, TagInfo, QueryResult } from "$lib/types.js";

import { searchStore, selectionStore } from "./stores.svelte.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 60;
const LOADING_DELAY = 200;
const SEARCH_DEBOUNCE = 300;

// ─── Timers (module-scoped) ─────────────────────────────────────────────────

let loadingTimer: ReturnType<typeof setTimeout> | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// ═══════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════

/** Hydrate search stores from SSR data. */
export function initSearch(recentItems: ImageWithId[], allTags: TagInfo[]) {
  searchStore.allTags = allTags;
  searchStore.items = recentItems;
  searchStore.total = recentItems.length;
  searchStore.page = 1;
  searchStore.pages = 1;
  searchStore.searchText = "";
  searchStore.selectedTags = [];
  searchStore.rating = undefined;
  searchStore.ratingOp = "gte";
  searchStore.sort = "committedAt";
  searchStore.order = "desc";
  searchStore.loading = false;
  searchStore.showLoading = false;

  selectionStore.selected = new Set();
}

// ═══════════════════════════════════════════════════════════
//  Search
// ═══════════════════════════════════════════════════════════

/** Execute a server query with the current filter state. */
export async function doSearch(resetPage = true) {
  if (resetPage) searchStore.page = 1;
  searchStore.loading = true;

  if (loadingTimer) clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    if (searchStore.loading) searchStore.showLoading = true;
  }, LOADING_DELAY);

  try {
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(searchStore.page));
    params.set("sort", searchStore.sort);
    params.set("order", searchStore.order);
    if (searchStore.searchText.trim()) params.set("search", searchStore.searchText.trim());
    if (searchStore.selectedTags.length > 0) params.set("tags", searchStore.selectedTags.join(","));
    if (searchStore.rating !== undefined) {
      params.set("rating", String(searchStore.rating));
      params.set("ratingOp", searchStore.ratingOp);
    }

    const res = await api.get<QueryResult>(`/api/images?${params.toString()}`);
    if (res.ok && res.data) {
      searchStore.items = res.data.items;
      searchStore.total = res.data.total;
      searchStore.pages = res.data.pages;
    }
  } finally {
    searchStore.loading = false;
    if (loadingTimer) clearTimeout(loadingTimer);
    searchStore.showLoading = false;
    // Drop any selected IDs that are no longer visible after filtering/paging
    validateSelection();
  }
}

/** Debounced text search. */
export function handleSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(), SEARCH_DEBOUNCE);
}

/** Immediate search on filter change. */
export function handleFilterChange() {
  doSearch();
}

/** Navigate to a specific page. */
export function goToPage(p: number) {
  if (p < 1 || p > searchStore.pages) return;
  searchStore.page = p;
  doSearch(false);
}

/**
 * Remove from the selection any IDs that are no longer present
 * in the current result page. Called automatically after every search.
 */
export function validateSelection() {
  if (selectionStore.selected.size === 0) return;
  const visibleIds = new Set(searchStore.items.map((item) => item.id));
  const next = new Set([...selectionStore.selected].filter((id) => visibleIds.has(id)));
  if (next.size !== selectionStore.selected.size) {
    selectionStore.selected = next;
  }
}

// ═══════════════════════════════════════════════════════════
//  Selection
// ═══════════════════════════════════════════════════════════

/** Whether selection mode is active. */
export function isSelecting(): boolean {
  return selectionStore.selected.size > 0;
}

/** Toggle selection of a single image by ID. */
export function toggleSelect(id: string) {
  const next = new Set(selectionStore.selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectionStore.selected = next;
}

/** Clear all selections. */
export function clearSelection() {
  selectionStore.selected = new Set();
}

/** Handle card click: navigate if not selecting, otherwise toggle. */
export function handleCardClick(id: string) {
  if (isSelecting()) {
    toggleSelect(id);
  } else {
    goto(`/editor/${id}`);
  }
}

/** Batch-delete selected images (console.log placeholder). */
export function deleteSelected() {
  const ids = [...selectionStore.selected];
  console.log("[Editor] Delete selected:", ids);
  addToast(`已選取 ${ids.length} 張圖片（刪除功能尚未實裝）`, "info");
}

/** Batch-rate selected images (console.log placeholder). */
export function rateSelected(rating: number) {
  const ids = [...selectionStore.selected];
  console.log("[Editor] Rate selected:", ids, "→", rating);
  addToast(`已選取 ${ids.length} 張圖片 → ${rating} 星（評等功能尚未實裝）`, "info");
}

// ═══════════════════════════════════════════════════════════
//  Keyboard
// ═══════════════════════════════════════════════════════════

export function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isSelecting()) {
    e.preventDefault();
    clearSelection();
    return;
  }

  const target = e.target as HTMLElement;
  const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

  if (inInput || e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "Escape") {
    e.preventDefault();
    goto("/");
  }
}
