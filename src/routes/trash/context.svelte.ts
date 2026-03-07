/**
 * Trash 頁面的 Context 定義
 *
 * 純資料結構，不包含方法。除了 $state 響應式屬性外，
 * 也持有非響應式的共享引用（timer、常數），
 * 讓各子元件的 doSearch 共用同一份 timer，避免 race condition。
 */

import { createContext } from "svelte";

/**
 * Trash 頁面共享的響應式狀態與非響應式引用
 */
export class TrashContext {
  // ─── 常數 ────────────────────────────────────────────

  /** 每頁筆數 */
  readonly PAGE_SIZE = 30;
  /** 載入提示延遲毫秒數 */
  readonly LOADING_DELAY = 200;
  /** 搜尋文字 debounce 毫秒數 */
  readonly SEARCH_DEBOUNCE = 300;

  // ─── 共享 Timer 引用 ─────────────────────────────────

  /** 載入提示延遲計時器（跨元件共享，避免 race condition） */
  loadingTimer: ReturnType<typeof setTimeout> | null = null;
  /** 搜尋文字 debounce 計時器（跨元件共享，避免 race condition） */
  searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── 篩選條件 ────────────────────────────────────────

  /** 搜尋文字 */
  searchText = $state("");

  // ─── 查詢結果 ────────────────────────────────────────

  /** 當前頁面的檔案名稱列表 */
  files = $state<string[]>([]);
  /** 符合條件的總數 */
  total = $state(0);
  /** 目前頁碼 */
  page = $state(1);
  /** 總頁數 */
  pages = $state(1);

  // ─── 載入狀態 ────────────────────────────────────────

  /** 是否正在載入 */
  loading = $state(false);
  /** 是否顯示載入提示（延遲顯示） */
  showLoading = $state(false);

  // ─── 選取狀態 ────────────────────────────────────────

  /** 已選取的檔案名稱集合 */
  selected = $state<Set<string>>(new Set());

  // ─── UI 狀態 ─────────────────────────────────────────

  /** 待確認對話框 */
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
}

export const [getTrashContext, setTrashContext] = createContext<TrashContext>();
