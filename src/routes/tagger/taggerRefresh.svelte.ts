import { invalidateAll } from "$app/navigation";
import { addToast } from "$lib/client/dom.js";

/**
 * TaggerRefresh 元件的配置選項
 */
type TaggerRefreshOptions = {
  /** 暫存檔案列表 */
  get stagedFiles(): string[];
  /** 雙向綁定：已選取的檔名集合 */
  get selectedFiles(): Set<string>;
  /** 雙向綁定：載入狀態 */
  get loading(): boolean;
  set loading(v: boolean);
};

/**
 * 建立側邊欄標題列邏輯的核心工廠函數
 */
export function createTaggerRefresh(options: TaggerRefreshOptions) {
  /** 檔案列表長度 */
  const listLength = $derived(options.stagedFiles.length);
  /** 已選取數量 */
  const selectedSize = $derived(options.selectedFiles.size);

  // ---

  /** 處理刷新按鈕點擊事件，重新掃描 staged 資料夾 */
  async function handleRefreshClick() {
    if (options.loading) return;
    options.loading = true;
    try {
      await invalidateAll();
      addToast("列表已更新", "success");
    } finally {
      options.loading = false;
    }
  }

  // ---

  return {
    /** 存取檔案列表長度的 getter */
    get listLength() {
      return listLength;
    },
    /** 存取已選取數量的 getter */
    get selectedSize() {
      return selectedSize;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return options.loading;
    },

    /** 處理刷新按鈕點擊事件，重新掃描 staged 資料夾 */
    handleRefreshClick,
  };
}
