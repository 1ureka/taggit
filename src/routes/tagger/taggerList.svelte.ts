import { api } from "$lib/client/api.js";
import { invalidateAll } from "$app/navigation";
import { addToast, isInEditable, scrollToActive } from "$lib/client/dom.js";

/**
 * TaggerList 的配置選項
 */
type TaggerListOptions = {
  /** 暫存檔案列表 */
  stagedFiles: string[];
  /** 雙向綁定：目前選取的檔名 */
  currentFile: string | null;
  /** 雙向綁定：已選取的檔名集合 */
  selectedFiles: Set<string>;
};

/**
 * TaggerList 的選取與切換啟用的互動邏輯
 */
export class TaggerListSelect {
  /** count badge 顯示文字 */
  countLabel: string | null;
  /** 選取的檔案數量顯示文字 */
  selectedLabel: string | null;

  constructor(private options: TaggerListOptions) {
    this.countLabel = $derived.by(() => {
      const total = options.stagedFiles.length;
      if (total <= 0) return null;

      const currentIndex = options.currentFile ? options.stagedFiles.indexOf(options.currentFile) : -1;
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
    this.options.currentFile = filename;
    this.options.selectedFiles = new Set([filename]);
  }

  /** 以 Ctrl 模式將指定檔名加入選取集合 */
  #selectCtrl(filename: string) {
    const next = new Set(this.options.selectedFiles);
    next.add(filename);
    this.options.currentFile = filename;
    this.options.selectedFiles = next;
  }

  /** 以 Shift 模式選取 currentFile 到指定檔名的範圍 */
  #selectShift(filename: string) {
    const list = this.options.stagedFiles;
    const anchorIdx = this.options.currentFile ? list.indexOf(this.options.currentFile) : 0;
    const targetIdx = list.indexOf(filename);
    const lo = Math.min(anchorIdx, targetIdx);
    const hi = Math.max(anchorIdx, targetIdx);
    const next = new Set<string>();
    for (let i = lo; i <= hi; i++) next.add(list[i]);
    this.options.currentFile = filename;
    this.options.selectedFiles = next;
  }

  /** 移動游標至指定偏移量 */
  #navigate(delta: -1 | 1) {
    if (!this.options.currentFile) return;
    const idx = this.options.stagedFiles.indexOf(this.options.currentFile);
    const next = idx + delta;
    if (next < 0 || next >= this.options.stagedFiles.length) return;
    const nextFile = this.options.stagedFiles[next];
    this.options.currentFile = nextFile;
    this.options.selectedFiles = new Set([nextFile]);
  }

  // ---

  /** 處理列表項目點擊事件，根據修飾鍵執行對應的選取模式 */
  handleItemClick = (e: MouseEvent, filename: string) => {
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";
    if (mode === "single") this.#selectSingle(filename);
    else if (mode === "ctrl") this.#selectCtrl(filename);
    else this.#selectShift(filename);
  };

  /** 處理 Window 鍵盤事件，執行方向鍵導航 */
  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.#navigate(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.#navigate(1);
    }
  };
}

/**
 * TaggerList 的操作互動邏輯
 */
export class TaggerListActions {
  /** 操作狀態 */
  pending = $state(false);

  /** 處理重新整理按鈕點擊事件，重新掃描並更新清單 */
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

  /** 處理檔案上傳 input change 事件 */
  handleUploadChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length || this.pending) return;

    this.pending = true;
    try {
      const body = new FormData();
      for (const f of input.files) body.append("files", f);

      const res = await api.post<{ added: string[]; errors: string[] }>("/api/staged", body);

      if (!res.ok || !res.data) {
        addToast(res.error || "上傳失敗", "error");
        return;
      }

      const { added, errors } = res.data;
      if (errors.length) addToast(`${errors.length} 個檔案加入失敗`, "error");
      if (added.length) addToast(`已加入 ${added.length} 張圖片`, "success");

      await invalidateAll();
    } catch {
      addToast("上傳請求失敗", "error");
    } finally {
      this.pending = false;
      input.value = "";
    }
  };
}

/**
 * TaggerList 的虛擬化配置選項
 */
type TaggerListVirtualOptions = {
  /** 暫存檔案列表 */
  stagedFiles: string[];
  /** 目前選取的檔案 */
  currentFile: string | null;
};

/**
 * TaggerList 的虛擬化邏輯
 */
export class TaggerListVirtual {
  /** 捲動容器 DOM 引用 */
  scrollContainer = $state<HTMLElement | null>(null);
  /** 虛擬列表單項固定高度 */
  readonly #listItemHeight = 72;
  /** 虛擬列表渲染緩衝區大小 */
  readonly #listBuffer = 5;
  /** 捲動容器目前的 listScrollTop */
  #listScrollTop = $state(0);
  /** 捲動容器可見高度 */
  #listViewHeight = $state(typeof window !== "undefined" ? window.innerHeight : 400);
  /** 虛擬列表內容總高度 */
  listTotalHeight: number;
  /** 可見的項目列表 */
  listVisibleItems: { filename: string; top: number; height: number }[];

  constructor(options: TaggerListVirtualOptions) {
    this.listTotalHeight = $derived(options.stagedFiles.length * this.#listItemHeight);

    this.listVisibleItems = $derived.by(() => {
      const firstVisibleIdx = Math.floor(this.#listScrollTop / this.#listItemHeight);
      const visibleCount = Math.ceil(this.#listViewHeight / this.#listItemHeight);

      const startIdx = Math.max(0, firstVisibleIdx - this.#listBuffer);
      const endIdx = Math.min(options.stagedFiles.length, firstVisibleIdx + visibleCount + this.#listBuffer);

      return options.stagedFiles.slice(startIdx, endIdx).map((filename, i) => ({
        filename,
        top: (startIdx + i) * this.#listItemHeight,
        height: this.#listItemHeight,
      }));
    });

    // ---

    // 監聽 currentFile，將對應項目捲入可視區域
    $effect(() => {
      if (!this.scrollContainer) return;

      const idx = options.currentFile ? options.stagedFiles.indexOf(options.currentFile) : -1;
      if (idx >= 0) scrollToActive(this.scrollContainer, idx, this.#listItemHeight);
    });

    // ResizeObserver 監聽 listEl，追蹤容器可視高度變化
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

  /** 處理列表捲動事件，同步 listScrollTop 狀態 */
  handleListScroll = () => {
    if (this.scrollContainer) this.#listScrollTop = this.scrollContainer.scrollTop;
  };
}
