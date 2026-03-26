import { api } from "$lib/client/api.js";
import { invalidateAll } from "$app/navigation";
import { addToast, scrollToActive } from "$lib/client/dom.js";

/**
 * 單個項目的高度
 */
const ITEM_HEIGHT = 72;

/**
 * TaggerList 的配置選項
 */
type TaggerListOptions = {
  /** 暫存檔案列表 */
  get stagedFiles(): string[];
  /** 雙向綁定：目前選取的檔名 */
  get currentFile(): string | null;
  set currentFile(v: string | null);
  /** 目前的選取的檔案索引 */
  get currentIndex(): number | null;
  /** 雙向綁定：已選取的檔名集合 */
  get selectedFiles(): Set<string>;
  set selectedFiles(v: Set<string>);
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

      const currentIndex = options.currentIndex ?? -1;
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
    const anchorIdx = this.options.currentIndex ?? 0;
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
    if (this.options.currentIndex === null) return;
    const idx = this.options.currentIndex;
    const next = idx + delta;
    if (next < 0 || next >= this.options.stagedFiles.length) return;
    const nextFile = this.options.stagedFiles[next];
    this.options.currentFile = nextFile;
    this.options.selectedFiles = new Set([nextFile]);
  }

  // ---

  /** 處理列表項目點擊事件，根據模式執行對應的選取行為 */
  handleListClick = (filename: string, mode: "single" | "ctrl" | "shift") => {
    if (mode === "single") this.#selectSingle(filename);
    else if (mode === "ctrl") this.#selectCtrl(filename);
    else this.#selectShift(filename);
  };

  /** 處理列表鍵盤事件，執行方向鍵導航 */
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
  get stagedFiles(): string[];
  /** 目前的選取的檔案索引 */
  get currentIndex(): number | null;
  /** 點擊某個項目的 callback */
  onClickItem?: (filename: string, mode: "single" | "ctrl" | "shift") => void;
};

/**
 * TaggerList 的虛擬化邏輯
 */
export class TaggerListVirtual {
  /** 捲動容器 DOM 引用 */
  scrollContainer = $state<HTMLElement | null>(null);
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

  constructor(private options: TaggerListVirtualOptions) {
    this.listTotalHeight = $derived(options.stagedFiles.length * ITEM_HEIGHT);

    this.listVisibleItems = $derived.by(() => {
      const stagedFiles = options.stagedFiles;
      const currentIndex = options.currentIndex;

      const firstVisibleIdx = Math.floor(this.#listScrollTop / ITEM_HEIGHT);
      const visibleCount = Math.ceil(this.#listViewHeight / ITEM_HEIGHT);

      const startIdx = Math.max(0, firstVisibleIdx - this.#listBuffer);
      const endIdx = Math.min(stagedFiles.length, firstVisibleIdx + visibleCount + this.#listBuffer);

      const items = stagedFiles.slice(startIdx, endIdx).map((filename, i) => ({
        filename,
        top: (startIdx + i) * ITEM_HEIGHT,
        height: ITEM_HEIGHT,
      }));

      // 以下將確保 ID 存在於 DOM，保證 aria-activedescendant 可用
      if (currentIndex === null) return items;
      if (currentIndex >= startIdx && currentIndex < endIdx) return items;

      const currentItem = {
        filename: stagedFiles[currentIndex],
        top: currentIndex * ITEM_HEIGHT,
        height: ITEM_HEIGHT,
      };

      if (currentIndex < startIdx && currentIndex >= 0) {
        items.unshift(currentItem);
      } else if (currentIndex >= endIdx && currentIndex < stagedFiles.length) {
        items.push(currentItem);
      }

      return items;
    });

    // ---

    // 監聽 currentIndex，將對應項目捲入可視區域
    $effect(() => {
      if (!this.scrollContainer) return;

      const idx = options.currentIndex ?? -1;
      if (idx >= 0) scrollToActive(this.scrollContainer, idx, ITEM_HEIGHT);
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

  /** 處理列表本身的點擊事件，透過數學方式計算出實際點擊的項目 */
  handleListClick = (e: MouseEvent) => {
    if (!this.scrollContainer) return;

    const rect = this.scrollContainer.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const absoluteY = relativeY + this.scrollContainer.scrollTop;
    const index = Math.floor(absoluteY / ITEM_HEIGHT);

    if (index < 0 || index >= this.options.stagedFiles.length) return;

    const filename = this.options.stagedFiles[index];
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";

    if (this.options.onClickItem) this.options.onClickItem(filename, mode);
  };

  /** 處理列表捲動事件，同步 listScrollTop 狀態 */
  handleListScroll = () => {
    if (this.scrollContainer) this.#listScrollTop = this.scrollContainer.scrollTop;
  };
}
