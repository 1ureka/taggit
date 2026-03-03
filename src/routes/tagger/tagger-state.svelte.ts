/**
 * @file tagger-state.svelte.ts
 *
 * Reactive state & business logic for the Tagger page.
 *
 * Design principles:
 *   - One class instance per page load, passed to all children.
 *   - Pure data operations live here; UI side-effects (scroll, zoom,
 *     focus) are delegated through two thin callbacks (`onNavigate`,
 *     `onFocusInput`) wired once by +page.svelte.
 *   - Repeated patterns (batch API, index removal) are extracted
 *     into small, testable helpers.
 */

import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import type { TagInfo } from "$lib/types.js";

// ─── Standalone helpers ───────────────────────────────────────────────────────

function stagedUrl(name: string): string {
  return `/img/staged/${encodeURIComponent(name)}`;
}

function imageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

/**
 * Process `items` through `fn` in fixed-size concurrent batches.
 * Returns `[successCount, failCount]`.
 */
async function batchRun<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<{ ok: boolean }>,
): Promise<[ok: number, fail: number]> {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.all(items.slice(i, i + size).map(fn));
    for (const r of results) r.ok ? ok++ : fail++;
  }
  return [ok, fail];
}

// ─── State ────────────────────────────────────────────────────────────────────

export class TaggerState {
  // ── File list ─────────────────────────────────────────────
  files = $state<string[]>([]);

  // ── Selection ─────────────────────────────────────────────
  cursor = $state(-1);
  selected = $state<Set<number>>(new Set());
  #anchor = 0;

  // ── Current edit ──────────────────────────────────────────
  tags = $state<string[]>([]);
  rating = $state(0);

  // ── Global tag catalogue (for autocomplete) ───────────────
  knownTags = $state<TagInfo[]>([]);

  // ── Progress ──────────────────────────────────────────────
  total = $state(0);
  processed = $state(0);

  // ── Async guards ──────────────────────────────────────────
  busy = $state(false);
  refreshing = $state(false);

  // ── Modals ────────────────────────────────────────────────
  toolsOpen = $state(false);
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);

  // ── Derived ───────────────────────────────────────────────
  currentFile = $derived<string | null>(
    this.cursor >= 0 && this.cursor < this.files.length ? this.files[this.cursor] : null,
  );
  previewUrl = $derived(this.currentFile ? stagedUrl(this.currentFile) : "");
  selectedCount = $derived(this.selected.size);
  progressPct = $derived(this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0);
  progressLabel = $derived(`${this.processed}/${this.total} (${this.files.length} 剩餘)`);

  // ── UI callbacks (wired once by +page.svelte) ─────────────
  onNavigate?: () => void;
  onFocusInput?: () => void;

  // ── Constructor ───────────────────────────────────────────

  constructor(files: string[], tags: TagInfo[]) {
    this.files = [...files];
    this.knownTags = [...tags];
    this.total = files.length;
  }

  // ═══════════════════════════════════════════════════════════
  //  Selection
  // ═══════════════════════════════════════════════════════════

  /** Move to a specific image. Single mode resets the edit form. */
  select(idx: number, mode: "single" | "ctrl" | "shift" = "single") {
    if (idx < 0 || idx >= this.files.length) return;

    if (mode === "single") {
      this.cursor = idx;
      this.selected = new Set([idx]);
      this.#anchor = idx;
      this.tags = [];
      this.rating = 0;
    } else if (mode === "ctrl") {
      const next = new Set(this.selected);
      next.has(idx) && next.size > 1 ? next.delete(idx) : next.add(idx);
      this.cursor = idx;
      this.selected = next;
      this.#anchor = idx;
    } else {
      const [lo, hi] = [Math.min(this.#anchor, idx), Math.max(this.#anchor, idx)];
      const next = new Set<number>();
      for (let i = lo; i <= hi; i++) next.add(i);
      this.cursor = idx;
      this.selected = next;
    }

    this.onNavigate?.();
    this.#preload(idx + 1);
  }

  /** Navigate by offset (−1 = prev, +1 = next). */
  navigate(delta: -1 | 1) {
    const next = this.cursor + delta;
    if (next >= 0 && next < this.files.length) this.select(next, "single");
  }

  // ═══════════════════════════════════════════════════════════
  //  Tag editing
  // ═══════════════════════════════════════════════════════════

  addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (this.tags.includes(tag)) {
      addToast("標籤已存在", "info");
      return;
    }
    this.tags = [...this.tags, tag];
  }

  removeTag(tag: string) {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  popTag() {
    if (this.tags.length) this.tags = this.tags.slice(0, -1);
  }

  toggleRating(n: number) {
    this.rating = n === this.rating ? 0 : n;
  }

  // ═══════════════════════════════════════════════════════════
  //  Commit
  // ═══════════════════════════════════════════════════════════

  async commit() {
    if (this.busy || this.selected.size === 0 || this.cursor < 0) return;
    if (this.tags.length === 0) {
      addToast("請至少加入一個標籤才能提交", "error");
      return;
    }

    this.busy = true;
    const names = this.#selectedFilenames();

    try {
      const [ok, fail] = await batchRun(names, 5, async (fn) => {
        const dims = await imageDimensions(stagedUrl(fn));
        return api.post(`/api/staged/${encodeURIComponent(fn)}`, {
          tags: this.tags,
          rating: this.rating,
          ...dims,
        });
      });

      if (ok) {
        this.processed += ok;
        addToast(ok === 1 ? `已提交: ${names[0]}` : `已提交 ${ok} 張圖片`, "success");
      }
      if (fail) addToast(`${fail} 張提交失敗`, "error");

      this.#removeByNames(names);
      this.refreshKnownTags();
    } finally {
      this.busy = false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Trash
  // ═══════════════════════════════════════════════════════════

  async trash() {
    if (this.selected.size === 0 || this.cursor < 0) return;

    const n = this.selected.size;
    const msg =
      n === 1 ? `確定要將「${this.files[this.cursor]}」移至垃圾桶？` : `確定要將選取的 ${n} 張圖片移至垃圾桶？`;
    if (!(await this.confirm(msg))) return;

    const names = this.#selectedFilenames();
    const [ok, fail] = await batchRun(names, 5, (fn) => api.del(`/api/staged/${encodeURIComponent(fn)}`));

    if (ok) {
      this.processed += ok;
      addToast(ok === 1 ? `已移至垃圾桶: ${names[0]}` : `已將 ${ok} 張圖片移至垃圾桶`, "info");
    }
    if (fail) addToast(`${fail} 張刪除失敗`, "error");

    this.#removeByNames(names);
  }

  // ═══════════════════════════════════════════════════════════
  //  Refresh
  // ═══════════════════════════════════════════════════════════

  async refresh() {
    this.refreshing = true;
    try {
      const res = await api.get<{ files: string[] }>("/api/staged");
      if (!res.ok || !res.data) return;

      const oldLen = this.files.length;
      this.files = res.data.files;
      this.selected = new Set();

      // Adjust cursor to valid range
      if (this.files.length === 0) {
        this.cursor = -1;
      } else if (this.cursor >= this.files.length) {
        this.select(this.files.length - 1, "single");
      } else if (oldLen === 0) {
        this.select(0, "single");
      }

      // Update progress total & toast
      const diff = this.files.length - oldLen;
      if (diff > 0) {
        this.total = this.total === 0 ? this.files.length : this.total + diff;
        addToast(`發現 ${diff} 張新圖片`, "success");
      } else if (diff === 0) {
        addToast("沒有發現新圖片", "info");
      } else {
        addToast(`列表已更新（減少 ${-diff} 張）`, "info");
      }
    } finally {
      this.refreshing = false;
    }
  }

  async refreshKnownTags() {
    const res = await api.get<{ tags: TagInfo[] }>("/api/metadata/tags");
    if (res.ok && res.data) this.knownTags = res.data.tags;
  }

  // ═══════════════════════════════════════════════════════════
  //  Confirm dialog
  // ═══════════════════════════════════════════════════════════

  confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingConfirm = { message, resolve };
    });
  }

  resolveConfirm(accepted: boolean) {
    this.pendingConfirm?.resolve(accepted);
    this.pendingConfirm = null;
  }

  // ═══════════════════════════════════════════════════════════
  //  Keyboard
  // ═══════════════════════════════════════════════════════════

  handleKeydown = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.contentEditable === "true") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const { key } = e;

    // Rating: 0-5
    if (key >= "0" && key <= "5") {
      e.preventDefault();
      this.toggleRating(parseInt(key));
      return;
    }

    const actions: Record<string, () => void> = {
      ArrowLeft: () => this.navigate(-1),
      ArrowRight: () => this.navigate(1),
      t: () => this.onFocusInput?.(),
      T: () => this.onFocusInput?.(),
      Enter: () => this.commit(),
      Delete: () => this.trash(),
      Escape: () => {
        if (this.toolsOpen) this.toolsOpen = false;
      },
    };

    const action = actions[key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  Private
  // ═══════════════════════════════════════════════════════════

  /** Get filenames for current selection, sorted by index. */
  #selectedFilenames(): string[] {
    return [...this.selected].sort((a, b) => a - b).map((i) => this.files[i]);
  }

  /** Remove named files from the list and reset selection to nearest valid. */
  #removeByNames(names: string[]) {
    const nameSet = new Set(names);
    this.files = this.files.filter((f) => !nameSet.has(f));
    this.selected = new Set();

    if (this.files.length === 0) {
      this.cursor = -1;
    } else {
      this.select(Math.min(this.cursor, this.files.length - 1), "single");
    }
  }

  /** Silently preload an image for smoother navigation. */
  #preload(idx: number) {
    if (idx >= 0 && idx < this.files.length) {
      new Image().src = stagedUrl(this.files[idx]);
    }
  }
}
