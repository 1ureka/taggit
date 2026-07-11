import { untrack } from "svelte";
import { goto, invalidateAll } from "$app/navigation";
import { addToast } from "$lib/ui/dom.js";
import type { ImageWithId } from "$lib/database";

/**
 * EditorListSelect 的配置選項
 */
type EditorListSelectOptions = {
  /** 唯讀，SSR 回傳的 id 列表 */
  get imageIds(): string[];
  /** 唯讀，SSR 回傳的當前圖片記錄 */
  get currentRecord(): ImageWithId | null;
  /** 唯讀，目前的圖片索引 */
  get currentIndex(): number | null;
};

/**
 * EditorList 的選取與切換啟用的互動邏輯
 */
export class EditorListSelect {
  /** 已選取的圖片 ID 集合 */
  selectedIds = $state<Set<string>>(new Set());
  /** count badge 顯示文字 */
  countLabel: string | null;
  /** 選取的檔案數量顯示文字 */
  selectedLabel: string | null;

  constructor(private options: EditorListSelectOptions) {
    this.#computeSelectedIds();
    $effect(() => {
      this.#computeSelectedIds(untrack(() => this.selectedIds));
    });

    this.countLabel = $derived.by(() => {
      const total = options.imageIds.length;
      if (total <= 0) return null;

      const currentIndex = options.currentIndex ?? -1;
      if (currentIndex < 0) return `${total}`;

      return `${currentIndex + 1}/${total}`;
    });

    this.selectedLabel = $derived.by(() => {
      const count = this.selectedIds.size;
      return count > 1 ? `${count} 已選取` : null;
    });
  }

  // ---

  /** 計算與驗證選取狀態 */
  #computeSelectedIds = (prev: Set<string> = new Set()) => {
    const ids = this.options.imageIds;
    const currentId = this.options.currentRecord?.id ?? null;

    if (!currentId || ids.length <= 0) {
      this.selectedIds = new Set();
      return;
    }

    const next = new Set([...prev].filter((f) => ids.includes(f)));

    if (next.size === 0) {
      this.selectedIds = new Set([currentId]);
    } else if (next.size !== prev.size) {
      this.selectedIds = next;
    }
  };

  // ---

  /** 導航到指定檔案（更新 URL 的 currentId 參數） */
  #navigateTo = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("currentId", id);
    goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
  };

  /** 以單選模式選取指定檔案 */
  #selectSingle(id: string) {
    this.selectedIds = new Set([id]);
    this.#navigateTo(id);
  }

  /** 以 Ctrl 模式將指定檔案加入選取集合 */
  #selectCtrl(id: string) {
    const next = new Set(this.selectedIds);
    next.add(id);
    this.selectedIds = next;
    this.#navigateTo(id);
  }

  /** 以 Shift 模式選取 currentIndex 到指定檔案的範圍 */
  #selectShift(id: string) {
    const list = this.options.imageIds;
    const anchorIdx = this.options.currentIndex ?? 0;
    const targetIdx = list.indexOf(id);
    const lo = Math.min(anchorIdx, targetIdx);
    const hi = Math.max(anchorIdx, targetIdx);
    const next = new Set<string>();
    for (let i = lo; i <= hi; i++) next.add(list[i]);
    this.selectedIds = next;
    this.#navigateTo(id);
  }

  /** 移動游標至指定偏移量 */
  #navigate(delta: -1 | 1) {
    if (this.options.currentIndex === null) return;
    const idx = this.options.currentIndex;
    const next = idx + delta;
    if (next < 0 || next >= this.options.imageIds.length) return;
    const nextFile = this.options.imageIds[next];
    this.selectedIds = new Set([nextFile]);
    this.#navigateTo(nextFile);
  }

  // ---

  /** 處理列表項目點擊事件 */
  handleListClick = (item: ImageWithId, mode: "single" | "ctrl" | "shift") => {
    if (mode === "single") this.#selectSingle(item.id);
    else if (mode === "ctrl") this.#selectCtrl(item.id);
    else this.#selectShift(item.id);
  };

  /** 處理列表鍵盤事件 */
  handleListKeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      this.#navigate(-1);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      this.#navigate(1);
      return;
    }
  };
}

/**
 * EditorList 的操作互動配置選項
 */
type EditorListOptions = {
  /** 雙向綁定：操作狀態 (共用鎖) */
  get pending(): boolean;
  set pending(v: boolean);
};

/**
 * EditorList 的操作互動邏輯
 */
export class EditorListActions {
  constructor(private options: EditorListOptions) {}

  /** 處理重新整理按鈕點擊事件 */
  handleRefreshClick = async () => {
    if (this.options.pending) return;
    this.options.pending = true;
    try {
      await invalidateAll();
      addToast("列表已更新", "success");
    } finally {
      this.options.pending = false;
    }
  };
}
