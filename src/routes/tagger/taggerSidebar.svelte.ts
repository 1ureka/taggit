import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import { getTaggerContext } from "./context.svelte.js";
import { scrollToActive } from "$lib/client/dom.js";

/**
 * 建立側邊欄邏輯的核心工廠函數
 */
export function createTaggerSidebar() {
  /** Tagger 頁面共享的 Context */
  const ctx = getTaggerContext();

  /** 隱藏的檔案上傳 input 元素 */
  let fileInputEl = $state<HTMLInputElement>();

  // ---

  /** 以單選模式選取指定索引並重置編輯狀態 */
  function selectSingle(idx: number) {
    ctx.cursor = idx;
    ctx.selected = new Set([idx]);
    ctx.tags = [];
    ctx.rating = 0;
    scrollToActive(ctx.listEl, idx, ctx.ITEM_H);
    ctx.zoomPan?.reset();
  }

  /** 重新掃描 staged 資料夾（不管理 loading 狀態） */
  async function refreshList() {
    const res = await api.get<{ files: string[] }>("/api/staged");
    if (!res.ok || !res.data) return;

    const oldLen = ctx.list.length;
    const oldFile = ctx.cursor >= 0 && ctx.cursor < ctx.list.length ? ctx.list[ctx.cursor] : null;

    ctx.list = res.data.files;
    ctx.selected = new Set();

    // ── 重新定位游標 ──
    if (ctx.list.length === 0) {
      ctx.cursor = -1;
    } else {
      const nextIdx = Math.min(ctx.cursor, ctx.list.length - 1);
      if (ctx.list[nextIdx] !== oldFile) ctx.imageLoading = true;
      selectSingle(Math.max(nextIdx, 0));
    }

    // ── Toast 通知 ──
    const diff = ctx.list.length - oldLen;
    if (diff > 0) {
      ctx.total = ctx.total === 0 ? ctx.list.length : ctx.total + diff;
      addToast(`發現 ${diff} 張新圖片`, "success");
    } else if (diff === 0) {
      addToast("沒有發現新圖片", "info");
    } else {
      addToast(`列表已更新（減少 ${-diff} 張）`, "info");
    }
  }

  // ---

  /** 處理重新整理按鈕點擊事件，重新掃描 staged 資料夾 */
  async function handleRefreshClick() {
    if (ctx.loading) return;
    ctx.loading = true;
    try {
      await refreshList();
    } finally {
      ctx.loading = false;
    }
  }

  /** 處理上傳按鈕點擊事件，觸發檔案選擇對話框 */
  function handleUploadClick() {
    fileInputEl?.click();
  }

  /** 處理檔案上傳 input change 事件，上傳選取的檔案 */
  async function handleUploadChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;

    ctx.loading = true;
    try {
      const body = new FormData();
      for (const f of input.files) body.append("files", f);

      const res = await fetch("/api/staged", { method: "POST", body });
      const json = await res.json();

      if (json.ok && json.data) {
        const { added, errors } = json.data as { added: string[]; errors: string[] };
        if (added.length) {
          addToast(`已加入 ${added.length} 張圖片`, "success");
          await refreshList();
        }
        if (errors.length) addToast(`${errors.length} 個檔案失敗`, "error");
      } else {
        addToast(json.error || "上傳失敗", "error");
      }
    } catch {
      addToast("上傳請求失敗", "error");
    } finally {
      ctx.loading = false;
      input.value = "";
    }
  }

  // ---

  return {
    /** 獲取檔案上傳 input 元素的 getter */
    get fileInputEl() {
      return fileInputEl as HTMLInputElement;
    },
    /** 設定檔案上傳 input 元素的 setter */
    set fileInputEl(el: HTMLInputElement) {
      fileInputEl = el;
    },

    /** 存取載入狀態的 getter */
    get loading() {
      return ctx.loading;
    },
    /** 存取檔案列表長度的 getter */
    get listLength() {
      return ctx.list.length;
    },
    /** 存取已選取數量的 getter */
    get selectedSize() {
      return ctx.selected.size;
    },

    /** 處理重新整理按鈕點擊事件，重新掃描 staged 資料夾 */
    handleRefreshClick,
    /** 處理上傳按鈕點擊事件，觸發檔案選擇對話框 */
    handleUploadClick,
    /** 處理檔案上傳 input change 事件，上傳選取的檔案 */
    handleUploadChange,
  };
}
