/**
 * 批次編輯多張圖片的表單狀態與邏輯
 */
export class EditorBatchForm {
  /** 評分欄位 */
  rating = $state(0);
  /** 是否碰過評分欄位 */
  ratingTouched = $state(false);
  /** 要新增的標籤 */
  addTags = $state<string[]>([]);
  /** 要刪除的標籤 */
  removeTags = $state<string[]>([]);
  /** 是否已修改 */
  dirty: boolean;

  constructor() {
    this.dirty = $derived(this.ratingTouched || this.addTags.length > 0 || this.removeTags.length > 0);
  }

  // ---

  /** 重置所有批次編輯欄位 */
  reset = () => {
    this.rating = 0;
    this.ratingTouched = false;
    this.addTags = [];
    this.removeTags = [];
  };

  /** 標記評分欄位已被使用者觸碰 */
  handleRatingChange = () => {
    this.ratingTouched = true;
  };
}
