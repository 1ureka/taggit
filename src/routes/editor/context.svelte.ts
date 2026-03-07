/**
 * Editor 搜尋頁面的 Context 定義
 *
 * 純資料結構，不包含方法。除了 $state 響應式屬性外，
 * 也持有非響應式的共享引用（timer、常數），
 * 讓各子元件的 doSearch 共用同一份 timer，避免 race condition。
 */

import { createContext } from "svelte";
import type { ImageWithId } from "$lib/types.js";

/**
 * Editor 頁面共享的響應式狀態與非響應式引用
 */
export class EditorContext {
  // ─── 常數 ────────────────────────────────────────────

  /** 每頁筆數 */
  readonly PAGE_SIZE = 60;
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
  /** 已選的篩選標籤 */
  selectedTags = $state<string[]>([]);
  /** 評等篩選值 */
  rating = $state<number | undefined>(undefined);
  /** 評等比較運算子 */
  ratingOp = $state<"gte" | "lte" | "eq">("gte");
  /** 排序欄位 */
  sort = $state("committedAt");
  /** 排序方向 */
  order = $state("desc");

  // ─── 查詢結果 ────────────────────────────────────────

  /** 查詢結果圖片列表 */
  items = $state<ImageWithId[]>([]);
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

  /** 已選取的圖片 ID 集合 */
  selected = $state<Set<string>>(new Set());

  // ─── UI 狀態 ─────────────────────────────────────────

  /** 待確認對話框 */
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
}

export const [getEditorContext, setEditorContext] = createContext<EditorContext>();
