import { api } from "$lib/utils/client.js";

/**
 * SettingsImages 的配置選項
 */
type SettingsImagesOptions = {
  /** 唯讀：快取統計資料 */
  cacheStats: { entries: number; bytes: number };
};

/**
 * SettingsImages 的互動邏輯
 */
export class SettingsImages {
  /** 快取項目數量 */
  cacheEntries = $state(0);
  /** 快取已使用位元組數 */
  cacheBytes = $state(0);
  /** 是否正在清空快取 */
  cacheBusy = $state(false);
  /** 清空快取結果訊息 */
  cacheResult = $state("");
  /** 缺失元資料的圖片數量（-1 表示尚未檢查） */
  metaMissing = $state(-1);
  /** 是否正在處理元資料 */
  metaBusy = $state(false);
  /** 元資料操作結果訊息 */
  metaResult = $state("");

  /** 快取已使用的 MB 數 */
  cacheMB: string;

  constructor(options: SettingsImagesOptions) {
    this.cacheEntries = options.cacheStats.entries;
    this.cacheBytes = options.cacheStats.bytes;

    this.cacheMB = $derived((this.cacheBytes / (1024 * 1024)).toFixed(1));
  }

  // ---

  /** 處理「清空快取」按鈕點擊事件，清空記憶體中的圖片快取 */
  handleClearBtnClick = async () => {
    this.cacheBusy = true;
    this.cacheResult = "";

    const res = await api.del<{ cleared: number }>("/api/settings/cache");
    if (res.ok && res.data) {
      this.cacheResult = `已清空 ${res.data.cleared} 筆快取`;
      this.cacheEntries = 0;
      this.cacheBytes = 0;
    } else {
      this.cacheResult = "錯誤: " + (res.error || "未知");
    }
    this.cacheBusy = false;
  };

  // ---

  /** 處理「開始檢查」按鈕點擊事件，檢查缺少元資料的圖片數量 */
  handleCheckBtnClick = async () => {
    this.metaBusy = true;
    this.metaResult = "";

    const res = await api.get<{ missing: number }>("/api/settings/metadata");
    if (res.ok && res.data) {
      this.metaMissing = res.data.missing;
      this.metaResult = res.data.missing === 0 ? "所有圖片的元資料皆完整" : `找到 ${res.data.missing} 張圖片缺少元資料`;
    } else {
      this.metaResult = "錯誤: " + (res.error || "未知");
    }
    this.metaBusy = false;
  };

  /** 處理「補算」按鈕點擊事件，批次補算缺失的元資料 */
  handleFixBtnClick = async () => {
    this.metaBusy = true;
    this.metaResult = "補算中，這可能需要一些時間…";

    const res = await api.post<{ updated: number }>("/api/settings/metadata");
    if (res.ok && res.data) {
      this.metaResult = res.data.updated > 0 ? `已為 ${res.data.updated} 張圖片補上元資料` : "沒有圖片需要補算";
      this.metaMissing = Math.max(0, this.metaMissing - res.data.updated);
    } else {
      this.metaResult = "錯誤: " + (res.error || "未知");
    }
    this.metaBusy = false;
  };
}
