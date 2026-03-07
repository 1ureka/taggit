/**
 * Scroll 瀏覽頁面的 Context 定義
 */
import { createContext } from "svelte";
import type { ImageWithId } from "$lib/types.js";

/**
 * Scroll 頁面共享的響應式狀態
 */
export class ScrollContext {
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

  /** 是否正在載入 */
  loading = $state(false);

  /** 瀑布流欄位數 */
  columns = $state(3);
  /** 頁面捲動容器 DOM 引用 */
  pageContentEl = $state<HTMLElement | null>(null);
}

export const [getScrollContext, setScrollContext] = createContext<ScrollContext>();
