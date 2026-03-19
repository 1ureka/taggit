import { navigating } from "$app/state";
import { invalidateAll } from "$app/navigation";
import { isInEditable } from "$lib/client/dom.js";

/**
 * CompareShuffle 的互動邏輯
 */
export class CompareShuffle {
  /** 按鈕是否禁用（導航中） */
  disabled: boolean;

  constructor() {
    this.disabled = $derived(!!navigating.to);
  }

  /** 處理 Shuffle 按鈕點擊事件，強制 load 重跑 */
  handleShuffleClick = () => {
    invalidateAll();
  };

  /** 處理 Window 鍵盤事件，Space 觸發 Shuffle */
  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;
    if (e.key === " ") {
      e.preventDefault();
      invalidateAll();
    }
  };
}
