import { isInEditable, scrollToActive } from "$lib/client/dom.js";

/** 虛擬列表單項固定高度 */
const ITEM_H = 72;

/**
 * TaggerList 元件的配置選項
 */
type TaggerListOptions = {
  /** 暫存檔案列表 */
  get stagedFiles(): string[];
  /** 雙向綁定：目前選取的檔名 */
  get currentFile(): string | null;
  set currentFile(v: string | null);
  /** 雙向綁定：已選取的檔名集合 */
  get selectedFiles(): Set<string>;
  set selectedFiles(v: Set<string>);
};

/**
 * 建立虛擬列表邏輯的核心工廠函數
 */
export function createTaggerList(options: TaggerListOptions) {
  /** 捲動容器 DOM 引用 */
  let listEl = $state<HTMLDivElement | null>(null);

  /** 虛擬列表渲染緩衝區大小 */
  const BUFFER = 5;

  /** 捲動容器目前的 scrollTop */
  let scrollTop = $state(0);
  /** 捲動容器可見高度 */
  let viewH = $state(400);

  /** 目前選取檔案在列表中的索引 */
  const currentFileIndex = $derived(options.currentFile ? options.stagedFiles.indexOf(options.currentFile) : -1);

  /** 虛擬列表內容總高度 */
  const totalH = $derived(options.stagedFiles.length * ITEM_H);
  /** 可見範圍的起始索引（含緩衝區） */
  const startIdx = $derived(Math.max(0, Math.floor(scrollTop / ITEM_H) - BUFFER));
  /** 可見範圍的結束索引（含緩衝區） */
  const endIdx = $derived(Math.min(options.stagedFiles.length, Math.ceil((scrollTop + viewH) / ITEM_H) + BUFFER));
  /** 可見的項目列表 */
  const visible = $derived(
    options.stagedFiles.slice(startIdx, endIdx).map((filename, i) => ({
      filename,
      index: startIdx + i,
    })),
  );

  // ---

  /** 以單選模式選取指定檔名 */
  function selectSingle(filename: string) {
    options.currentFile = filename;
    options.selectedFiles = new Set([filename]);
  }

  /** 以 Ctrl 模式切換指定檔名的選取狀態 */
  function selectCtrl(filename: string) {
    const next = new Set(options.selectedFiles);
    next.has(filename) && next.size > 1 ? next.delete(filename) : next.add(filename);
    options.currentFile = filename;
    options.selectedFiles = next;
  }

  /** 以 Shift 模式選取 currentFile 到指定檔名的範圍 */
  function selectShift(filename: string) {
    const list = options.stagedFiles;
    const anchorIdx = options.currentFile ? list.indexOf(options.currentFile) : 0;
    const targetIdx = list.indexOf(filename);
    const lo = Math.min(anchorIdx, targetIdx);
    const hi = Math.max(anchorIdx, targetIdx);
    const next = new Set<string>();
    for (let i = lo; i <= hi; i++) next.add(list[i]);
    options.currentFile = filename;
    options.selectedFiles = next;
  }

  /** 移動游標至指定偏移量 */
  function navigate(delta: -1 | 1) {
    if (!options.currentFile) return;
    const idx = options.stagedFiles.indexOf(options.currentFile);
    const next = idx + delta;
    if (next < 0 || next >= options.stagedFiles.length) return;
    const nextFile = options.stagedFiles[next];
    options.currentFile = nextFile;
    options.selectedFiles = new Set([nextFile]);
  }

  // ---

  /** 處理列表項目點擊事件，根據修飾鍵執行對應的選取模式 */
  function handleItemClick(e: MouseEvent, filename: string) {
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";
    if (mode === "single") selectSingle(filename);
    else if (mode === "ctrl") selectCtrl(filename);
    else selectShift(filename);
  }

  /** 處理列表捲動事件，同步 scrollTop 狀態 */
  function handleListScroll() {
    if (listEl) scrollTop = listEl.scrollTop;
  }

  /** 處理 Window 鍵盤事件，執行方向鍵導航 */
  function handleWindowKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      navigate(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      navigate(1);
    }
  }

  // ---

  /** scrollToActive：監聽 currentFile，將對應項目捲入可視區域 */
  $effect(() => {
    const idx = currentFileIndex;
    if (idx >= 0) {
      scrollToActive(listEl, idx, ITEM_H);
    }
  });

  /** ResizeObserver：監聽 listEl，追蹤 viewH */
  $effect(() => {
    if (!listEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) viewH = e.contentRect.height;
    });
    ro.observe(listEl);
    return () => ro.disconnect();
  });

  // ---

  return {
    /** 獲取列表容器 DOM 的 getter */
    get listEl() {
      return listEl;
    },
    /** 設定列表容器 DOM 的 setter */
    set listEl(el: HTMLDivElement | null) {
      listEl = el;
    },

    /** 存取虛擬列表內容總高度的 getter */
    get totalH() {
      return totalH;
    },
    /** 存取可見項目列表的 getter */
    get visible() {
      return visible;
    },
    /** 存取項目固定高度的 getter */
    get ITEM_H() {
      return ITEM_H;
    },

    /** 處理列表項目點擊事件，根據修飾鍵執行對應的選取模式 */
    handleItemClick,
    /** 處理列表捲動事件，同步 scrollTop 狀態 */
    handleListScroll,
    /** 處理 Window 鍵盤事件，執行方向鍵導航 */
    handleWindowKeydown,
  };
}
