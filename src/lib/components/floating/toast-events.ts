/** Toast 通知種類 */
export type ToastVariant = "success" | "error" | "info";

export const TOAST_ADD = "toast:add";
export const TOAST_PROGRESS_UPDATE = "toast:progress:update";
export const TOAST_PROGRESS_DONE = "toast:progress:done";
export const TOAST_HISTORY_SHOW = "toast:history:show";
export const TOAST_HISTORY_HIDE = "toast:history:hide";

export interface ToastAddPayload {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastProgressUpdatePayload {
  id: number;
  progress: number;
  message?: string;
}

export interface ToastProgressDonePayload {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

// write-only，只用來讓同一次 addToast()/withProgressToast() 呼叫在兩個獨立監聽者（ToastStage／ToastList）
// 之間對上同一個 id；從不被讀出來影響任何畫面輸出，SSR 下即使誤觸也只是徒增數字，不構成跨 request 洩漏。
let nextId = 0;

function dispatch<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
}

/**
 * 新增一個 Toast 通知
 */
export function addToast(opts: { message: string; variant?: ToastVariant }): void {
  const id = nextId++;
  const payload = { id, message: opts.message, variant: opts.variant ?? "info", duration: 3000 };
  dispatch<ToastAddPayload>(TOAST_ADD, payload);
}

/**
 * 將一個非同步的行為轉換為 Toast 進度型通知
 */
export async function withProgressToast<T>(
  task: (update: (pct: number, message?: string) => void) => Promise<T>,
  formatError: (error: unknown) => string = (e) => (e instanceof Error ? e.message : "未知的錯誤"),
): Promise<T | undefined> {
  const id = nextId++;
  dispatch<ToastAddPayload>(TOAST_ADD, { id, message: "處理中...", variant: "info", duration: 0 });

  try {
    const result = await task((pct, message) => {
      dispatch<ToastProgressUpdatePayload>(TOAST_PROGRESS_UPDATE, { id, progress: pct, message });
    });

    // TODO: 只能顯示個完成有點爛
    const payload = { id, variant: "success", message: "完成", duration: 4000 } as const;
    dispatch<ToastProgressDonePayload>(TOAST_PROGRESS_DONE, payload);
    return result;
  } catch (e) {
    const payload = { id, variant: "error", message: formatError(e), duration: 5000 } as const;
    dispatch<ToastProgressDonePayload>(TOAST_PROGRESS_DONE, payload);
    return undefined;
  }
}

/**
 * 開啟全螢幕 Toast 通知歷史紀錄
 */
export function showToasts(): void {
  dispatch(TOAST_HISTORY_SHOW, undefined);
}

/**
 * 關閉全螢幕 Toast 通知歷史紀錄
 */
export function hideToasts(): void {
  dispatch(TOAST_HISTORY_HIDE, undefined);
}
