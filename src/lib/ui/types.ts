/**
 * 帶有寬高屬性的基本物件介面
 */
export type ItemWithSize = { id: string; width: number; height: number };

// ---

/**
 * 前端 Toast 類型
 */
export type ToastType = "success" | "error" | "info";

/**
 * 前端 Toast CustomEvent 的事件名稱
 */
export type ToastEventName = "toast:add";

/**
 * 前端 Toast CustomEvent 攜帶的資料
 */
export interface ToastPayload {
  type: ToastType;
  message: string;
  duration: number;
}

// ---

/**
 * 進度 Toast 的 start 事件名稱
 */
export type ToastProgressStartEventName = "toast:progress:start";

/**
 * 進度 Toast 的 update 事件名稱
 */
export type ToastProgressUpdateEventName = "toast:progress:update";

/**
 * 進度 Toast 的 done 事件名稱
 */
export type ToastProgressDoneEventName = "toast:progress:done";

/**
 * 進度 Toast start 事件的資料。
 * `resolveId` 用於將建立的 toast ID 回傳給呼叫端。
 */
export interface ToastProgressStartPayload {
  label: string;
  resolveId: (id: number) => void;
}

/**
 * 進度 Toast update 事件的資料
 */
export interface ToastProgressUpdatePayload {
  id: number;
  message: string;
  progress: number;
}

/**
 * 進度 Toast done 事件的資料
 */
export interface ToastProgressDonePayload {
  id: number;
  type: "success" | "error";
  message: string;
  duration: number;
}

// ---

/**
 * 前端 Confirm CustomEvent 的事件名稱
 */
export type ConfirmEventName = "confirm:request";

/**
 * 前端 Confirm CustomEvent 攜帶的資料
 */
export interface ConfirmPayload {
  message: string;
  title?: string;
  action?: string;
  resolve: (value: boolean) => void;
}

// ---

/**
 * 一個圖示組件的 props
 */
export type IconProps = {
  /** 圖示大小 (CSS 單位) */
  size?: number | string;
  /** 圖示顏色 (CSS 顏色值) */
  color?: string;
};
