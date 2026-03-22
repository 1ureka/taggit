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
type RatingStarState = {
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
 * 評分元件的互動邏輯
 */
export class Rating {
  /** 目前滑鼠懸停的星號索引，0 = 未懸停 */
  hoveredValue = $state(0);

  constructor(private options: RatingOptions) {}

  // ---

  #commit(next: number) {
    if (this.options.readonly) return;
    this.options.value = next;
    this.options.onchange?.(next);
  }

  // ---

  /**
   * 取得指定星號（1–5）的視覺狀態
   * @param i 星號索引（1 到 5）
   */
  getStarState(i: number): RatingStarState {
    const displayValue = this.hoveredValue > 0 ? this.hoveredValue : this.options.value;
    return {
      filled: i <= this.options.value,
      bright: i <= displayValue,
    };
  }

  // ---

  /** 處理星號滑鼠移入事件，更新懸停值 */
  handleStarMouseEnter = (i: number) => {
    if (this.options.readonly) return;
    this.hoveredValue = i;
  };

  /** 處理評分容器滑鼠移出事件，清除懸停值 */
  handleContainerMouseLeave = () => {
    this.hoveredValue = 0;
  };

  /** 處理星號點擊事件；點擊同一顆星則切換清除 */
  handleStarClick = (i: number) => {
    if (this.options.readonly) return;
    this.#commit(i === this.options.value ? 0 : i);
  };

  /**
   * 處理評分容器鍵盤事件（容器需設置 tabindex="0"）
   *
   * ArrowRight/Up → +1，ArrowLeft/Down → -1，Home → 0，End → 5
   */
  handleContainerKeydown = (e: KeyboardEvent) => {
    if (this.options.readonly) return;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        this.#commit(Math.min(this.options.value + 1, 5));
        break;

      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        this.#commit(Math.max(this.options.value - 1, 0));
        break;

      case "Home":
        e.preventDefault();
        this.#commit(0);
        break;

      case "End":
        e.preventDefault();
        this.#commit(5);
        break;
    }
  };
}
