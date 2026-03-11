import { invalidateAll } from "$app/navigation";
import { batchRun } from "$lib/utils.js";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";
import { tagCache } from "$lib/client/cache.js";

/**
 * TaggerForm 元件的配置選項
 */
type TaggerFormOptions = {
  /** 目前選取的檔名 */
  get currentFile(): string | null;
  /** 雙向綁定：已選取的檔名集合 */
  get selectedFiles(): Set<string>;
  set selectedFiles(v: Set<string>);
  /** 雙向綁定：載入狀態 */
  get loading(): boolean;
  set loading(v: boolean);
  /** 雙向綁定：已處理數量 */
  get progress(): number;
  set progress(v: number);
};

/**
 * 建立標籤表單邏輯的核心工廠函數
 */
export function createTaggerForm(options: TaggerFormOptions) {
  /** 標籤列表 */
  let tags = $state<string[]>([]);
  /** 評等 0–5 */
  let rating = $state(0);
  /** 標籤輸入框的容器 DOM 引用 */
  let tagInputWrapEl = $state<HTMLDivElement>();

  /** 已選取的圖片數量 */
  const selectedCount = $derived(options.selectedFiles.size);

  // ---

  /** 切換評等值 */
  function toggleRating(n: number) {
    rating = n === rating ? 0 : n;
  }

  /** 聚焦標籤輸入框 */
  function focusTagInput() {
    tagInputWrapEl?.querySelector("input")?.focus();
  }

  /** 重置表單 */
  function resetForm() {
    tags = [];
    rating = 0;
  }

  /** 提交已選取的圖片 */
  async function doCommit() {
    if (options.loading || options.selectedFiles.size === 0) return;
    if (tags.length === 0) {
      addToast("請至少加入一個標籤才能提交", "error");
      return;
    }

    const names = [...options.selectedFiles];
    options.loading = true;

    try {
      const [ok, fail] = await batchRun(names, 5, async (fn) => {
        return api.post(`/api/staged/${encodeURIComponent(fn)}`, { tags, rating });
      });

      if (ok) {
        addToast(ok === 1 ? `已提交: ${names[0]}` : `已提交 ${ok} 張圖片`, "success");
      }
      if (fail) addToast(`${fail} 張提交失敗`, "error");

      tagCache.invalidate();
      options.progress += ok;
      await invalidateAll();
    } finally {
      options.loading = false;
    }
  }

  /** 將已選取的圖片移至垃圾桶 */
  async function doTrash() {
    if (options.loading || options.selectedFiles.size === 0) return;

    const n = options.selectedFiles.size;
    const msg = n === 1 ? `確定要將「${options.currentFile}」移至垃圾桶？` : `確定要將選取的 ${n} 張圖片移至垃圾桶？`;
    if (!(await requestConfirm(msg))) return;

    const names = [...options.selectedFiles];
    options.loading = true;

    try {
      const [ok, fail] = await batchRun(names, 5, (fn) => api.del(`/api/staged/${encodeURIComponent(fn)}`));

      if (ok) {
        addToast(ok === 1 ? `已移至垃圾桶: ${names[0]}` : `已將 ${ok} 張圖片移至垃圾桶`, "info");
      }
      if (fail) addToast(`${fail} 張刪除失敗`, "error");

      options.progress += ok;
      await invalidateAll();
    } finally {
      options.loading = false;
    }
  }

  // ---

  /** 處理 Window 鍵盤事件，執行導航、評等、聚焦、提交或刪除操作 */
  function handleWindowKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const { key } = e;

    /** 當按下 0–5 時，切換評等 */
    if (key >= "0" && key <= "5") {
      e.preventDefault();
      toggleRating(parseInt(key));
      return;
    }

    const actions: Record<string, () => void> = {
      t: () => focusTagInput(),
      T: () => focusTagInput(),
      Enter: () => doCommit(),
      Delete: () => doTrash(),
    };

    const action = actions[key];
    if (action) {
      e.preventDefault();
      action();
    }
  }

  /** 處理提交按鈕點擊事件，提交已選取的圖片 */
  function handleCommitClick() {
    doCommit();
  }

  /** 處理刪除按鈕點擊事件，將已選取的圖片移至垃圾桶 */
  function handleTrashClick() {
    doTrash();
  }

  /** 處理重置按鈕點擊事件，清空表單 */
  function handleResetClick() {
    resetForm();
  }

  /** 處理標籤 Enter 事件，執行提交 */
  function handleTagEnter() {
    doCommit();
  }

  // ---

  return {
    /** 存取標籤輸入區塊包裝元素的 getter */
    get tagInputWrapEl() {
      return tagInputWrapEl as HTMLDivElement;
    },
    /** 設定標籤輸入區塊包裝元素的 setter */
    set tagInputWrapEl(el: HTMLDivElement) {
      tagInputWrapEl = el;
    },

    /** 存取標籤列表的 getter */
    get tags() {
      return tags;
    },
    /** 設定標籤列表的 setter */
    set tags(v: string[]) {
      tags = v;
    },
    /** 存取評等的 getter */
    get rating() {
      return rating;
    },
    /** 設定評等的 setter */
    set rating(v: number) {
      rating = v;
    },
    /** 存取已選取數量的 getter */
    get selectedCount() {
      return selectedCount;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return options.loading;
    },

    /** 處理 Window 鍵盤事件，執行導航、評等、聚焦、提交或刪除操作 */
    handleWindowKeydown,
    /** 處理提交按鈕點擊事件，提交已選取的圖片 */
    handleCommitClick,
    /** 處理刪除按鈕點擊事件，將已選取的圖片移至垃圾桶 */
    handleTrashClick,
    /** 處理重置按鈕點擊事件，清空表單 */
    handleResetClick,
    /** 處理標籤 Enter 事件，執行提交 */
    handleTagEnter,
  };
}
