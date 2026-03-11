/**
 * 單顆星星的視覺狀態
 *
 * 視覺由兩個獨立維度決定：
 *
 * filled（圖示）：i ≤ value → IconStarFilled；否則 IconStar
 * bright（顏色）：i ≤ displayValue（= hoveredValue > 0 ? hoveredValue : value）→ 亮色；否則暗色
 *
 * 因此懸停往下（H < V）時，H < i ≤ V 的星星會呈現「暗色 + 填滿圖示」——
 * 暗示這些星星「即將被取消」，這是原始元件設計保留的行為。
 */
export type RatingStarState = {
  /** true → 使用 IconStarFilled；false → 使用 IconStar */
  filled: boolean;
  /** true → 套用 class:bright（此星在顯示值範圍內，即 i ≤ displayValue） */
  bright: boolean;
};

/**
 * 評分組件的配置選項
 */
type RatingOptions = {
  /** 雙向綁定：目前分數（0–5），0 = 未評分 */
  value: number;
  /** 當分數變更時觸發的回調 */
  onchange?: (value: number) => void;
  /** 設為 true 時為唯讀模式（無互動） */
  readonly?: boolean;
};

/**
 * 建立評分元件邏輯的核心工廠函數
 */
export function createRating(options: RatingOptions) {
  /** 目前滑鼠懸停的星號索引，0 = 未懸停 */
  let hoveredValue = $state(0);

  // ---

  /**
   * 取得指定星號（1–5）的視覺狀態
   * @param i 星號索引（1 到 5）
   */
  function getStarState(i: number): RatingStarState {
    const displayValue = hoveredValue > 0 ? hoveredValue : options.value;
    return {
      filled: i <= options.value,
      bright: i <= displayValue,
    };
  }

  // ---

  /** 提交新分數；點擊已選中的同一顆星則清除為 0（切換） */
  function commit(next: number) {
    if (options.readonly) return;
    options.value = next;
    options.onchange?.(next);
  }

  // ---

  /** 處理星號滑鼠移入事件，更新懸停值 */
  function handleStarMouseEnter(i: number) {
    if (options.readonly) return;
    hoveredValue = i;
  }

  /** 處理評分容器滑鼠移出事件，清除懸停值 */
  function handleContainerMouseLeave() {
    hoveredValue = 0;
  }

  /** 處理星號點擊事件；點擊同一顆星則切換清除 */
  function handleStarClick(i: number) {
    if (options.readonly) return;
    commit(i === options.value ? 0 : i);
  }

  /**
   * 處理評分容器鍵盤事件（容器需設置 tabindex="0"）
   *
   * ArrowRight/Up → +1，ArrowLeft/Down → -1，Home → 0，End → 5
   */
  function handleContainerKeydown(e: KeyboardEvent) {
    if (options.readonly) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        commit(Math.min(options.value + 1, 5));
        break;

      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        commit(Math.max(options.value - 1, 0));
        break;

      case "Home":
        e.preventDefault();
        commit(0);
        break;

      case "End":
        e.preventDefault();
        commit(5);
        break;
    }
  }

  // ---

  return {
    /** 取得指定星號（1–5）的視覺狀態，包含 filled / bright */
    getStarState,

    /** 處理星號滑鼠移入事件 */
    handleStarMouseEnter,
    /** 處理評分容器滑鼠移出事件 */
    handleContainerMouseLeave,
    /** 處理星號點擊事件 */
    handleStarClick,
    /** 處理評分容器鍵盤事件（需綁定在 tabindex="0" 的容器上） */
    handleContainerKeydown,
  };
}
