/**
 * @file stores.svelte.ts
 *
 * Pure data store for the Browse filter page.
 * Only holds filter-related reactive state.
 * All mutations happen exclusively through actions (see actions.ts).
 */

import type { TagInfo } from "$lib/types.js";

// ═══════════════════════════════════════════════════════════
//  Filter Store
// ═══════════════════════════════════════════════════════════

class FilterStore {
  allTags = $state<TagInfo[]>([]);
  tags = $state<string[]>([]);
  minRating = $state(0);
  sort = $state<"committedAt" | "rating" | "originalName" | "random">("committedAt");
  matchCount = $state(0);
  counting = $state(false);
}

export const filterStore = new FilterStore();
