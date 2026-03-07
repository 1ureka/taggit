/**
 * Tagger 頁面的 Context 定義
 *
 * 純資料結構，不包含方法。持有 $state 響應式屬性
 * 與非響應式的共享引用（DOM 元素、zoom-pan 實例），
 * 讓各子元件可直接操作 DOM 而非透過 tick 間接通知。
 */

import { createContext } from "svelte";
import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

/**
 * Tagger 頁面共享的響應式狀態與非響應式引用
 */
export class TaggerContext {
  // ─── 常數 ────────────────────────────────────────────

  /** 虛擬列表單項固定高度 */
  readonly ITEM_H = 72;

  // ─── 共享引用（非響應式）─────────────────────────────

  /** 圖片預覽 zoom-pan 實例 */
  zoomPan: ReturnType<typeof useZoomPan> | null = null;

  // ─── DOM 元素引用 ────────────────────────────────────

  /** 虛擬列表捲動容器 */
  listEl = $state<HTMLDivElement | null>(null);

  // ─── 檔案列表 ────────────────────────────────────────

  /** Staged 檔案名稱列表 */
  list = $state<string[]>([]);
  /** 初始檔案總數（含已處理） */
  total = $state(0);

  // ─── 選取狀態 ────────────────────────────────────────

  /** 目前游標位置 */
  cursor = $state(-1);
  /** 已選取的索引集合 */
  selected = $state<Set<number>>(new Set());

  // ─── 編輯狀態 ────────────────────────────────────────

  /** 目前標籤列表 */
  tags = $state<string[]>([]);
  /** 目前評等 */
  rating = $state(0);

  // ─── 載入狀態 ────────────────────────────────────────

  /** 統一載入狀態（同一時間只做一種操作） */
  loading = $state(false);

  // ─── UI 狀態 ─────────────────────────────────────────

  /** 待確認對話框 */
  pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
}

export const [getTaggerContext, setTaggerContext] = createContext<TaggerContext>();
