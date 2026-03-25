import { invalidateAll } from "$app/navigation";
import { addToast, scrollToActive } from "$lib/client/dom.js";

/**
 * 單個項目的高度
 */
const ITEM_HEIGHT = 72;

/**
 * EditorListSelect 的配置選項
 */
type EditorListSelectOptions = {
  /** SSR 回傳的 id 列表 */
  imageIds: string[];
  /** 目前的圖片 id（來自 currentRecord） */
  currentId: string | null;
  /** 雙向綁定：已選取的檔名集合 */
  selectedFiles: Set<string>;
  /** 導航到指定檔案 */
  navigateTo: (filename: string) => void;
};

/**
 * EditorList 的選取與切換啟用的互動邏輯
 */
export class EditorListSelect {
  /** count badge 顯示文字 */
  countLabel: string | null;
  /** 選取的檔案數量顯示文字 */
  selectedLabel: string | null;

  constructor(private options: EditorListSelectOptions) {
    this.countLabel = $derived.by(() => {
      const total = options.imageIds.length;
      if (total <= 0) return null;

      const currentIndex = options.currentId ? options.imageIds.indexOf(options.currentId) : -1;
      if (currentIndex < 0) return `${total}`;

      return `${currentIndex + 1}/${total}`;
    });

    this.selectedLabel = $derived.by(() => {
      const count = options.selectedFiles.size;
      return count > 1 ? `${count} 已選取` : null;
    });
  }

  // ---

  /** 以單選模式選取指定檔名 */
  #selectSingle(filename: string) {
    this.options.selectedFiles = new Set([filename]);
    this.options.navigateTo(filename);
  }

  /** 以 Ctrl 模式將指定檔名加入選取集合 */
  #selectCtrl(filename: string) {
    const next = new Set(this.options.selectedFiles);
    next.add(filename);
    this.options.selectedFiles = next;
    this.options.navigateTo(filename);
  }

  /** 以 Shift 模式選取 currentId 到指定檔名的範圍 */
  #selectShift(filename: string) {
    const list = this.options.imageIds;
    const anchorIdx = this.options.currentId ? list.indexOf(this.options.currentId) : 0;
    const targetIdx = list.indexOf(filename);
    const lo = Math.min(anchorIdx, targetIdx);
    const hi = Math.max(anchorIdx, targetIdx);
    const next = new Set<string>();
    for (let i = lo; i <= hi; i++) next.add(list[i]);
    this.options.selectedFiles = next;
    this.options.navigateTo(filename);
  }

  /** 移動游標至指定偏移量 */
  #navigate(delta: -1 | 1) {
    if (!this.options.currentId) return;
    const idx = this.options.imageIds.indexOf(this.options.currentId);
    const next = idx + delta;
    if (next < 0 || next >= this.options.imageIds.length) return;
    const nextFile = this.options.imageIds[next];
    this.options.selectedFiles = new Set([nextFile]);
    this.options.navigateTo(nextFile);
  }

  // ---

  /** 處理列表項目點擊事件 */
  handleListClick = (filename: string, mode: "single" | "ctrl" | "shift") => {
    if (mode === "single") this.#selectSingle(filename);
    else if (mode === "ctrl") this.#selectCtrl(filename);
    else this.#selectShift(filename);
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
 * EditorList 的操作互動邏輯
 */
export class EditorListActions {
  /** 操作狀態 */
  pending = $state(false);

  /** 處理重新整理按鈕點擊事件 */
  handleRefreshClick = async () => {
    if (this.pending) return;
    this.pending = true;
    try {
      await invalidateAll();
      addToast("列表已更新", "success");
    } finally {
      this.pending = false;
    }
  };
}

/**
 * EditorListVirtual 的配置選項
 */
type EditorListVirtualOptions = {
  /** SSR 回傳的已提交檔案列表 */
  committedFiles: { id: string; name: string }[];
  /** 目前的圖片 id */
  currentId: string | null;
  /** 點擊某個提交項目的 callback */
  onClickItem?: (id: string, mode: "single" | "ctrl" | "shift") => void;
};

/**
 * EditorList 的虛擬化邏輯
 */
export class EditorListVirtual {
  /** 捲動容器 DOM 引用 */
  scrollContainer = $state<HTMLElement | null>(null);
  /** 虛擬列表渲染緩衝區大小 */
  readonly #listBuffer = 5;
  /** 捲動容器目前的 scrollTop */
  #listScrollTop = $state(0);
  /** 捲動容器可見高度 */
  #listViewHeight = $state(typeof window !== "undefined" ? window.innerHeight : 400);
  /** 虛擬列表內容總高度 */
  listTotalHeight: number;
  /** 可見的項目列表 */
  listVisibleItems: { id: string; name: string; top: number; height: number }[];

  constructor(private options: EditorListVirtualOptions) {
    this.listTotalHeight = $derived(options.committedFiles.length * ITEM_HEIGHT);

    this.listVisibleItems = $derived.by(() => {
      const firstVisibleIdx = Math.floor(this.#listScrollTop / ITEM_HEIGHT);
      const visibleCount = Math.ceil(this.#listViewHeight / ITEM_HEIGHT);

      const startIdx = Math.max(0, firstVisibleIdx - this.#listBuffer);
      const endIdx = Math.min(options.committedFiles.length, firstVisibleIdx + visibleCount + this.#listBuffer);

      return options.committedFiles.slice(startIdx, endIdx).map(({ id, name }, i) => ({
        id,
        name,
        top: (startIdx + i) * ITEM_HEIGHT,
        height: ITEM_HEIGHT,
      }));
    });

    // 監聽 currentId，將對應項目捲入可視區域
    $effect(() => {
      if (!this.scrollContainer) return;
      if (!options.currentId) return;

      const idx = options.committedFiles.findIndex(({ id }) => id === options.currentId);
      if (idx >= 0) scrollToActive(this.scrollContainer, idx, ITEM_HEIGHT);
    });

    // ResizeObserver 監聽容器高度
    $effect(() => {
      if (!this.scrollContainer) return;

      const ro = new ResizeObserver((entries) => {
        for (const e of entries) this.#listViewHeight = e.contentRect.height;
      });

      ro.observe(this.scrollContainer);
      return () => ro.disconnect();
    });
  }

  // ---

  /** 處理列表本身的點擊事件 */
  handleListClick = (e: MouseEvent) => {
    if (!this.scrollContainer) return;

    const rect = this.scrollContainer.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const absoluteY = relativeY + this.scrollContainer.scrollTop;
    const index = Math.floor(absoluteY / ITEM_HEIGHT);

    if (index < 0 || index >= this.options.committedFiles.length) return;

    const { id } = this.options.committedFiles[index];
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";

    if (this.options.onClickItem) this.options.onClickItem(id, mode);
  };

  /** 處理列表捲動事件 */
  handleListScroll = () => {
    if (this.scrollContainer) this.#listScrollTop = this.scrollContainer.scrollTop;
  };
}
