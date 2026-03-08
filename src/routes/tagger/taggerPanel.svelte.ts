import { api } from "$lib/client/api.js";
import { isInEditable } from "$lib/client/dom.js";
import { addToast } from "$lib/client/toast.js";
import { tagCache } from "$lib/client/cache.js";
import { getTaggerContext } from "./context.svelte.js";
import { batchRun } from "$lib/utils.js";
import { scrollToActive } from "$lib/client/dom.js";

/**
 * 建立標籤面板邏輯的核心工廠函數
 */
export function createTaggerPanel() {
  /** Tagger 頁面共享的 Context */
  const ctx = getTaggerContext();

  /** 標籤輸入區塊的包裝元素 */
  let tagInputWrapEl = $state<HTMLDivElement>();

  /** 已選取的圖片數量 */
  const selectedCount = $derived(ctx.selected.size);

  // ---

  /** 取得已選取檔案的檔名列表 */
  function selectedFilenames(): string[] {
    return [...ctx.selected].sort((a, b) => a - b).map((i) => ctx.list[i]);
  }

  /** 移除指定檔名的項目並更新選取狀態 */
  function removeByNames(names: string[]) {
    const nameSet = new Set(names);
    ctx.list = ctx.list.filter((f) => !nameSet.has(f));
    ctx.selected = new Set();

    if (ctx.list.length === 0) {
      ctx.cursor = -1;
    } else {
      const next = Math.min(ctx.cursor, ctx.list.length - 1);
      ctx.cursor = next;
      ctx.selected = new Set([next]);
      ctx.tags = [];
      ctx.rating = 0;
      scrollToActive(ctx.listEl, next, ctx.ITEM_H);
      ctx.zoomPan?.reset();
    }
  }

  /** 移動游標至指定偏移量 */
  function navigate(delta: -1 | 1) {
    const next = ctx.cursor + delta;
    if (next < 0 || next >= ctx.list.length) return;
    ctx.cursor = next;
    ctx.selected = new Set([next]);
    ctx.tags = [];
    ctx.rating = 0;
    scrollToActive(ctx.listEl, next, ctx.ITEM_H);
    ctx.zoomPan?.reset();
  }

  /** 切換評等值 */
  function toggleRating(n: number) {
    ctx.rating = n === ctx.rating ? 0 : n;
  }

  /** 聚焦標籤輸入框 */
  function focusTagInput() {
    tagInputWrapEl?.querySelector("input")?.focus();
  }

  /** 顯示確認對話框並等待使用者回應 */
  function confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      ctx.pendingConfirm = { message, resolve };
    });
  }

  /** 提交已選取的圖片 */
  async function doCommit() {
    if (ctx.loading || ctx.selected.size === 0 || ctx.cursor < 0) return;
    if (ctx.tags.length === 0) {
      addToast("請至少加入一個標籤才能提交", "error");
      return;
    }

    ctx.loading = true;
    const names = selectedFilenames();

    try {
      const [ok, fail] = await batchRun(names, 5, async (fn) => {
        return api.post(`/api/staged/${encodeURIComponent(fn)}`, {
          tags: ctx.tags,
          rating: ctx.rating,
        });
      });

      if (ok) {
        addToast(ok === 1 ? `已提交: ${names[0]}` : `已提交 ${ok} 張圖片`, "success");
      }
      if (fail) addToast(`${fail} 張提交失敗`, "error");

      removeByNames(names);
      tagCache.invalidate();
    } finally {
      ctx.loading = false;
    }
  }

  /** 將已選取的圖片移至垃圾桶 */
  async function doTrash() {
    if (ctx.loading) return;
    if (ctx.selected.size === 0 || ctx.cursor < 0) {
      addToast("沒有選取任何圖片", "info");
      return;
    }

    const n = ctx.selected.size;
    const msg = n === 1 ? `確定要將「${ctx.list[ctx.cursor]}」移至垃圾桶？` : `確定要將選取的 ${n} 張圖片移至垃圾桶？`;
    if (!(await confirmDialog(msg))) return;

    ctx.loading = true;
    const names = selectedFilenames();

    try {
      const [ok, fail] = await batchRun(names, 5, (fn) => api.del(`/api/staged/${encodeURIComponent(fn)}`));

      if (ok) {
        addToast(ok === 1 ? `已移至垃圾桶: ${names[0]}` : `已將 ${ok} 張圖片移至垃圾桶`, "info");
      }
      if (fail) addToast(`${fail} 張刪除失敗`, "error");

      removeByNames(names);
    } finally {
      ctx.loading = false;
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
      ArrowLeft: () => navigate(-1),
      ArrowRight: () => navigate(1),
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

    /** 存取已選取數量的 getter */
    get selectedCount() {
      return selectedCount;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return ctx.loading;
    },

    /** 處理 Window 鍵盤事件，執行導航、評等、聚焦、提交或刪除操作 */
    handleWindowKeydown,
    /** 處理提交按鈕點擊事件，提交已選取的圖片 */
    handleCommitClick,
    /** 處理刪除按鈕點擊事件，將已選取的圖片移至垃圾桶 */
    handleTrashClick,
    /** 處理標籤 Enter 事件，執行提交 */
    handleTagEnter,
  };
}
