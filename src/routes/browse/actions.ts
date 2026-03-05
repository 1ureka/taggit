/**
 * @file actions.ts
 *
 * Business logic for the Browse filter page.
 * Actions are the ONLY place that mutates the filterStore.
 *
 * Player logic lives entirely in /browse/player/+page.svelte (pure JS).
 */

import type { QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";
import { debounce } from "$lib/utils.js";
import { goto } from "$app/navigation";
import { filterStore } from "./stores.svelte.js";

const DEBOUNCE_COUNT = 200;

// ═══════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════

/**
 * Initialize browse page.
 * If `initialCount` is provided (from SSR), use it directly to avoid an
 * extra client-side round-trip on first load.
 */
export function initBrowse(initialCount?: number) {
  filterStore.tags = [];
  filterStore.minRating = 0;
  filterStore.sort = "committedAt";
  filterStore.counting = false;

  if (initialCount !== undefined) {
    filterStore.matchCount = initialCount;
  } else {
    filterStore.matchCount = 0;
    updateCount();
  }
}

// ═══════════════════════════════════════════════════════════
//  Filter Operations
// ═══════════════════════════════════════════════════════════

export function setMinRating(n: number) {
  filterStore.minRating = n === filterStore.minRating ? 0 : n;
  updateCount();
}

/** Debounced count query: GET /api/images?limit=1&page=1&... → total */
export const updateCount = debounce(async () => {
  filterStore.counting = true;
  try {
    const params = new URLSearchParams({ limit: "1", page: "1" });
    if (filterStore.tags.length > 0) params.set("tags", filterStore.tags.join(","));
    if (filterStore.minRating > 0) {
      params.set("rating", String(filterStore.minRating));
      params.set("ratingOp", "gte");
    }
    const res = await api.get<QueryResult>(`/api/images?${params}`);
    filterStore.matchCount = res.ok && res.data ? res.data.total : 0;
  } catch {
    filterStore.matchCount = 0;
  } finally {
    filterStore.counting = false;
  }
}, DEBOUNCE_COUNT) as () => void;

// ═══════════════════════════════════════════════════════════
//  Start Player (navigate to /browse/player with URL params)
// ═══════════════════════════════════════════════════════════

export function startPlayer() {
  if (filterStore.matchCount === 0) return;

  const params = new URLSearchParams();
  if (filterStore.tags.length > 0) params.set("tags", filterStore.tags.join(","));
  if (filterStore.minRating > 0) params.set("rating", String(filterStore.minRating));
  params.set("sort", filterStore.sort);
  if (filterStore.sort !== "random") {
    params.set("order", filterStore.sort === "originalName" ? "asc" : "desc");
  }

  const qs = params.toString();
  goto(`/browse/player${qs ? "?" + qs : ""}`);
}
