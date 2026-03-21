import { invalidateAll } from "$app/navigation";
import { addToast } from "$lib/client/dom.js";

/**
 * TaggerRefresh 的互動邏輯
 */
export class TaggerRefresh {
  /** 重新整理操作狀態 */
  pending = $state(false);

  // ---

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
}
