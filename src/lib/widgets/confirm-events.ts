/**
 * @file confirm-events.ts
 * 全域確認對話框的事件協定。ConfirmDialog 以全域單例掛在殼層，
 * 任何地方呼叫 {@link requestConfirm} 即可取得使用者的確認結果。
 */

export const CONFIRM_REQUEST = "confirm:request";

export interface ConfirmRequestPayload {
  /** 確認訊息內容 */
  message: string;
  /** 對話框標題（預設「確認」） */
  title?: string;
  /** 確認按鈕文字（預設「確認」） */
  action?: string;
  /** 使用者做出選擇後回傳結果 */
  resolve: (value: boolean) => void;
}

/**
 * 顯示全域確認對話框並等待使用者回應。
 */
export function requestConfirm(message: string, options?: { title?: string; action?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const detail: ConfirmRequestPayload = { message, ...options, resolve };
    window.dispatchEvent(new CustomEvent<ConfirmRequestPayload>(CONFIRM_REQUEST, { detail }));
  });
}
