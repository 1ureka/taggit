import type { ConfirmEventName, ConfirmPayload } from "$lib/types.js";

/**
 * 確認對話框的互動邏輯
 */
export class ConfirmModal {
  /** 對話框是否開啟 */
  open = $state(false);
  /** 確認訊息內容 */
  message = $state("");
  /** 對話框標題 */
  title = $state("確認");
  /** 確認按鈕文字 */
  action = $state("確認");

  #resolveRef: ((v: boolean) => void) | null = null;

  constructor() {
    $effect(() => {
      const onConfirmRequest = (e: Event) => {
        const { message: msg, title, action, resolve } = (e as CustomEvent<ConfirmPayload>).detail;
        this.#resolveRef?.(false);
        this.message = msg;
        this.title = title ?? "確認";
        this.action = action ?? "確認";
        this.#resolveRef = resolve;
        this.open = true;
      };

      const eventName: ConfirmEventName = "confirm:request";
      window.addEventListener(eventName, onConfirmRequest);
      return () => window.removeEventListener(eventName, onConfirmRequest);
    });
  }

  // ---

  #doConfirm() {
    this.#resolveRef?.(true);
    this.#resolveRef = null;
    this.open = false;
  }

  #doCancel() {
    this.#resolveRef?.(false);
    this.#resolveRef = null;
    this.open = false;
  }

  // ---

  /** 處理確認按鈕點擊事件，執行確認動作 */
  handleConfirmClick = () => {
    this.#doConfirm();
  };

  /** 處理取消按鈕點擊事件，執行取消動作 */
  handleCancelClick = () => {
    this.#doCancel();
  };

  // ---

  /** 處理 Modal 關閉事件（overlay 點擊、Escape），執行取消動作 */
  handleModalClose = () => {
    this.#doCancel();
  };
}
