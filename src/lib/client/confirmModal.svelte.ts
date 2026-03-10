import type { ConfirmEventName, ConfirmPayload } from "$lib/types.js";

/**
 * 建立確認對話框邏輯的核心工廠函數
 */
export function createConfirmModal() {
  /** 對話框是否開啟 */
  let open = $state(false);
  /** 確認訊息內容 */
  let message = $state("");

  /** 當前確認請求的 resolve 回調引用 */
  let resolveRef: ((v: boolean) => void) | null = null;

  // ---

  /** 執行確認並關閉對話框 */
  function doConfirm() {
    resolveRef?.(true);
    resolveRef = null;
    open = false;
  }

  /** 執行取消並關閉對話框 */
  function doCancel() {
    resolveRef?.(false);
    resolveRef = null;
    open = false;
  }

  // ---

  /** 處理確認按鈕點擊事件，執行確認動作 */
  function handleConfirmClick() {
    doConfirm();
  }

  /** 處理取消按鈕點擊事件，執行取消動作 */
  function handleCancelClick() {
    doCancel();
  }

  // ---

  /** 處理 Modal 關閉事件（overlay 點擊、Escape），執行取消動作 */
  function handleModalClose() {
    doCancel();
  }

  // ---

  /** 監聽 window custom event，接收外部 requestConfirm 派發的請求 */
  $effect(() => {
    function onConfirmRequest(e: Event) {
      const { message: msg, resolve } = (e as CustomEvent<ConfirmPayload>).detail;
      message = msg;
      resolveRef = resolve;
      open = true;
    }

    const eventName: ConfirmEventName = "confirm:request";
    window.addEventListener(eventName, onConfirmRequest);
    return () => window.removeEventListener(eventName, onConfirmRequest);
  });

  // ---

  return {
    /** 存取對話框開啟狀態的 getter */
    get open() {
      return open;
    },
    /** 設定對話框開啟狀態的 setter */
    set open(v: boolean) {
      open = v;
    },
    /** 存取確認訊息內容的 getter */
    get message() {
      return message;
    },

    /** 處理確認按鈕點擊事件，執行確認動作 */
    handleConfirmClick,
    /** 處理取消按鈕點擊事件，執行取消動作 */
    handleCancelClick,
    /** 處理 Modal 關閉事件（overlay 點擊、Escape），執行取消動作 */
    handleModalClose,
  };
}
