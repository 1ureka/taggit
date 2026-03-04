/**
 * @file actions.ts
 *
 * Business logic for the Browse filter page.
 * Actions are the ONLY place that mutates the filterStore.
 *
 * Player logic lives entirely in /browse/player/+page.svelte (pure JS).
 */

import { api } from "$lib/client/api.js";
import { debounce } from "$lib/utils.js";
import type { QueryResult, TagInfo } from "$lib/types.js";
import { goto } from "$app/navigation";

import { filterStore } from "./stores.svelte.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_COUNT = 200;

// ═══════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════

/** Reset filter store and hydrate SSR data. */
export function initBrowse(allTags: TagInfo[]) {
  filterStore.allTags = allTags;
  filterStore.tags = [];
  filterStore.minRating = 0;
  filterStore.sort = "committedAt";
  filterStore.matchCount = 0;
  filterStore.counting = false;

  updateCount();
}

// ═══════════════════════════════════════════════════════════
//  Filter Operations
// ═══════════════════════════════════════════════════════════

export function addTag(tag: string) {
  const t = tag.trim().toLowerCase();
  if (!t || filterStore.tags.includes(t)) return;
  filterStore.tags = [...filterStore.tags, t];
  updateCount();
}

export function removeTag(tag: string) {
  filterStore.tags = filterStore.tags.filter((t) => t !== tag);
  updateCount();
}

export function setMinRating(n: number) {
  filterStore.minRating = n === filterStore.minRating ? 0 : n;
  updateCount();
}

export function setSort(s: "committedAt" | "rating" | "originalName" | "random") {
  filterStore.sort = s;
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
