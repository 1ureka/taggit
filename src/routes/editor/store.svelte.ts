/**
 * Editor 搜尋頁面的 Context 定義
 */

import { createContext } from "svelte";
import type { ImageWithId } from "$lib/types.js";

/**
 * Editor 頁面共享的響應式狀態
 */
export class EditorContext {
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

  /** 查詢結果圖片列表 */
  items = $state<ImageWithId[]>([]);
  /** 符合條件的總數 */
  total = $state(0);
  /** 目前頁碼 */
  page = $state(1);
  /** 總頁數 */
  pages = $state(1);

  /** 是否正在載入 */
  loading = $state(false);
  /** 是否顯示載入提示（延遲顯示） */
  showLoading = $state(false);

  /** 已選取的圖片 ID 集合 */
  selected = $state<Set<string>>(new Set());

  /** 待確認對話框 */
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
}

export const [getEditorContext, setEditorContext] = createContext<EditorContext>();
