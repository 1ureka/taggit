import { navigating } from "$app/state";
import { invalidateAll } from "$app/navigation";
import { isInEditable } from "$lib/ui/dom";

/**
 * CompareShuffle 的互動邏輯
 */
export class CompareShuffle {
  /** 是否正在 invalidating */
  #invalidating = $state(false);
  /** 目前是否無法使用 shuffle，當頁面導航中或正在 invalidating 時為 true */
  pending: boolean;

  constructor() {
    this.pending = $derived(!!navigating.to || this.#invalidating);
  }

  // ---

  /** 執行 Shuffle 操作 */
  async #shuffle() {
    if (this.pending) return;
    this.#invalidating = true;
    await invalidateAll();
    this.#invalidating = false;
  }

  // ---

  /** 處理 Shuffle 按鈕點擊事件，強制 load 重跑 */
  handleShuffleClick = () => {
    this.#shuffle();
  };

  /** 處理 Window 鍵盤事件，Space 觸發 Shuffle */
  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;
    if (e.key === " ") {
      e.preventDefault();
      this.#shuffle();
    }
  };
}
