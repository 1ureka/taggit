/**
 * Settings 頁面的 Context 定義
 *
 * 純資料結構，不包含方法。持有 $state 響應式屬性
 * 讓各子元件共享頁面級狀態。
 */

import { createContext } from "svelte";

/**
 * Settings 頁面共享的響應式狀態
 */
export class SettingsContext {
  /** 圖片集根目錄 */
  collectionRoot = $state("");
  /** URL 通知類型（由 hooks 重導時帶入） */
  alert = $state<string | null>(null);
  /** 待確認對話框 */
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
}

export const [getSettingsContext, setSettingsContext] = createContext<SettingsContext>();
