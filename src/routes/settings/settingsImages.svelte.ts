import { api } from "$lib/client/api.js";
import { getSettingsContext } from "./context.svelte.js";

/**
 * 建立圖片與快取章節邏輯的核心工廠函數
 */
export function createSettingsImages() {
  /** Settings 頁面共享的 Context */
  const ctx = getSettingsContext();

  /** 快取已使用的 MB 數 */
  const cacheMB = $derived((ctx.cacheBytes / (1024 * 1024)).toFixed(1));
  /** 是否正在清空快取 */
  let cacheBusy = $state(false);
  /** 清空快取結果訊息 */
  let cacheResult = $state("");
  /** 缺失元資料的圖片數量（-1 表示尚未檢查） */
  let metaMissing = $state(-1);
  /** 是否正在處理元資料 */
  let metaBusy = $state(false);
  /** 元資料操作結果訊息 */
  let metaResult = $state("");

  // ---

  /** 處理「清空快取」按鈕點擊事件，清空記憶體中的圖片快取 */
  async function handleClearBtnClick() {
    cacheBusy = true;
    cacheResult = "";

    const res = await api.del("/api/maintenance/cache");
    if (res.ok) {
      cacheResult = "已清空圖片快取";
      ctx.cacheEntries = 0;
      ctx.cacheBytes = 0;
    } else {
      cacheResult = "錯誤: " + (res.error || "未知");
    }
    cacheBusy = false;
  }

  // ---

  /** 處理「開始檢查」按鈕點擊事件，檢查缺少元資料的圖片數量 */
  async function handleCheckBtnClick() {
    metaBusy = true;
    metaResult = "";

    const res = await api.get<{ missing: number }>("/api/metadata");
    if (res.ok && res.data) {
      metaMissing = res.data.missing;
      metaResult = res.data.missing === 0 ? "所有圖片的元資料皆完整" : `找到 ${res.data.missing} 張圖片缺少元資料`;
    } else {
      metaResult = "錯誤: " + (res.error || "未知");
    }
    metaBusy = false;
  }

  /** 處理「補算」按鈕點擊事件，批次補算缺失的元資料 */
  async function handleFixBtnClick() {
    metaBusy = true;
    metaResult = "補算中，這可能需要一些時間…";

    const res = await api.post<{ updated: number }>("/api/metadata");
    if (res.ok && res.data) {
      metaResult = res.data.updated > 0 ? `已為 ${res.data.updated} 張圖片補上元資料` : "沒有圖片需要補算";
      metaMissing = Math.max(0, metaMissing - res.data.updated);
    } else {
      metaResult = "錯誤: " + (res.error || "未知");
    }
    metaBusy = false;
  }

  // ---

  return {
    /** 存取快取項目數量的 getter */
    get cacheEntries() {
      return ctx.cacheEntries;
    },
    /** 存取快取 MB 數的 getter */
    get cacheMB() {
      return cacheMB;
    },
    /** 存取清空快取處理狀態的 getter */
    get cacheBusy() {
      return cacheBusy;
    },
    /** 存取清空快取結果訊息的 getter */
    get cacheResult() {
      return cacheResult;
    },
    /** 存取缺失元資料數量的 getter */
    get metaMissing() {
      return metaMissing;
    },
    /** 存取元資料處理狀態的 getter */
    get metaBusy() {
      return metaBusy;
    },
    /** 存取元資料結果訊息的 getter */
    get metaResult() {
      return metaResult;
    },
    /** 處理「清空快取」按鈕點擊事件，清空記憶體中的圖片快取 */
    handleClearBtnClick,
    /** 處理「開始檢查」按鈕點擊事件，檢查缺少元資料的圖片數量 */
    handleCheckBtnClick,
    /** 處理「補算」按鈕點擊事件，批次補算缺失的元資料 */
    handleFixBtnClick,
  };
}
