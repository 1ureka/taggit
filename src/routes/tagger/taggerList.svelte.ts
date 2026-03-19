import { isInEditable, scrollToActive } from "$lib/client/dom.js";

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
 * TaggerList 的互動邏輯
 */
export class TaggerList {
  /** 捲動容器 DOM 引用 */
  listEl = $state<HTMLDivElement | null>(null);
  /** 虛擬列表單項固定高度 */
  readonly ITEM_H = 72;

  /** 捲動容器目前的 scrollTop */
  #scrollTop = $state(0);
  /** 捲動容器可見高度 */
  #viewH = $state(400);
  /** 虛擬列表渲染緩衝區大小 */
  readonly #BUFFER = 5;

  /** 目前選取檔案在列表中的索引 */
  #currentFileIndex: number;
  /** 虛擬列表內容總高度 */
  totalH: number;
  /** 可見的項目列表 */
  visible: { filename: string; index: number }[];

  constructor(private options: TaggerListOptions) {
    this.#currentFileIndex = $derived(
      options.currentFile ? options.stagedFiles.indexOf(options.currentFile) : -1,
    );
    this.totalH = $derived(options.stagedFiles.length * this.ITEM_H);

    const startIdx = $derived(Math.max(0, Math.floor(this.#scrollTop / this.ITEM_H) - this.#BUFFER));
    const endIdx = $derived(
      Math.min(options.stagedFiles.length, Math.ceil((this.#scrollTop + this.#viewH) / this.ITEM_H) + this.#BUFFER),
    );
    this.visible = $derived(
      options.stagedFiles.slice(startIdx, endIdx).map((filename, i) => ({
        filename,
        index: startIdx + i,
      })),
    );

    // scrollToActive：監聽 currentFile，將對應項目捲入可視區域
    $effect(() => {
      const idx = this.#currentFileIndex;
      if (idx >= 0) scrollToActive(this.listEl, idx, this.ITEM_H);
    });

    // ResizeObserver：監聽 listEl，追蹤 viewH
    $effect(() => {
      if (!this.listEl) return;
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) this.#viewH = e.contentRect.height;
      });
      ro.observe(this.listEl);
      return () => ro.disconnect();
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

  /** 處理列表捲動事件，同步 scrollTop 狀態 */
  handleListScroll = () => {
    if (this.listEl) this.#scrollTop = this.listEl.scrollTop;
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
