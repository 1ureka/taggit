/**
 * @file stores.svelte.ts
 *
 * Pure data stores for the /editor/[id] edit page.
 * Each store holds only reactive state — no logic, no side-effects.
 * All mutations happen exclusively through actions (see actions.ts).
 *
 * Stores:
 *   editStore  — current image editing session (tags, rating, dirty state)
 *   uiStore    — modals & cross-component signals
 *
 * Search-page stores live in ../stores.svelte.ts.
 */

import type { ImageWithId } from "$lib/types.js";

// ═══════════════════════════════════════════════════════════
//  Edit Store
// ═══════════════════════════════════════════════════════════

class EditStore {
  image = $state<ImageWithId | null>(null);
  currentTags = $state<string[]>([]);
  currentRating = $state(0);
  dirty = $state(false);
  saving = $state(false);
  lastUpdatedAt = $state(0);
}

export const editStore = new EditStore();

// ═══════════════════════════════════════════════════════════
//  UI Store
// ═══════════════════════════════════════════════════════════

class UIStore {
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
}

export const uiStore = new UIStore();
