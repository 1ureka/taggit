import { invalidateAll } from "$app/navigation";
import { addToast } from "$lib/client/dom.js";

/**
 * TaggerRefresh 的配置選項
 */
type TaggerRefreshOptions = {
  /** 暫存檔案列表 */
  stagedFiles: string[];
  /** 雙向綁定：已選取的檔名集合 */
  selectedFiles: Set<string>;
  /** 雙向綁定：載入狀態 */
  loading: boolean;
};

/**
 * TaggerRefresh 的互動邏輯
 */
export class TaggerRefresh {
  /** badge 顯示文字 */
  badgeLabel: string;

  constructor(private options: TaggerRefreshOptions) {
    this.badgeLabel = $derived(
      options.selectedFiles.size > 1
        ? `${options.selectedFiles.size}/${options.stagedFiles.length}`
        : `${options.stagedFiles.length}`,
    );
  }

  // ---

  /** 存取載入狀態（委派至 options） */
  get loading() {
    return this.options.loading;
  }

  // ---

  /** 處理刷新按鈕點擊事件，重新載入暫存檔案列表 */
  handleRefreshClick = async () => {
    if (this.options.loading) return;
    this.options.loading = true;
    try {
      await invalidateAll();
      addToast("列表已更新", "success");
    } finally {
      this.options.loading = false;
    }
  };
}
