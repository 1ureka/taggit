/**
 * Editor 詳細編輯頁面的 Context 定義
 */
import { createContext } from "svelte";
import type { ImageWithId } from "$lib/types.js";

/**
 * Editor 詳細編輯頁面共享的響應式狀態與非響應式引用
 */
export class EditorDetailContext {
  /** 自動儲存 debounce 毫秒數 */
  readonly SAVE_DEBOUNCE = 800;

  /** 自動儲存 debounce 計時器（跨元件共享，避免 race condition） */
  saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 目前編輯中的圖片完整資料 */
  image = $state<ImageWithId | null>(null);

  /** 是否有未儲存的變更 */
  dirty = $state(false);
  /** 操作載入狀態（儲存、刪除等） */
  loading = $state(false);
}

export const [getEditorDetailContext, setEditorDetailContext] = createContext<EditorDetailContext>();
