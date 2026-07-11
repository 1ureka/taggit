import type { ImageWithId } from "$lib/database";

/**
 * 編輯單張圖片的表單狀態配置選項
 */
type EditorFormOptions = {
  /** 唯讀：SSR 回傳的當前圖片記錄 */
  get currentRecord(): ImageWithId | null;
};

/**
 * 編輯單張圖片的表單狀態與邏輯
 */
export class EditorForm {
  /** 名稱欄位 */
  name: string;
  /** 標籤欄位 */
  tags: string[];
  /** 評分欄位 */
  rating: number;
  /** 是否已修改 */
  dirty: boolean;

  constructor(private options: EditorFormOptions) {
    this.name = $derived(options.currentRecord?.name ?? "");
    this.tags = $derived([...(options.currentRecord?.tags ?? [])]);
    this.rating = $derived(options.currentRecord?.rating ?? 0);

    // 透過比較不變的 SSR currentRecord 與可被使用者暫時覆蓋的 name/tags/rating 來判斷是否有修改過表單
    this.dirty = $derived.by(() => {
      const rec = options.currentRecord;
      if (!rec) return false;
      if (this.name !== rec.name) return true;
      if (this.rating !== rec.rating) return true;
      if (this.tags.length !== rec.tags.length) return true;
      if (this.tags.some((t, i) => t !== rec.tags[i])) return true;
      return false;
    });
  }

  // ---

  /** 重置表單欄位為當前圖片記錄的值 */
  reset = () => {
    const rec = this.options.currentRecord;
    this.name = rec?.name ?? "";
    this.tags = [...(rec?.tags ?? [])];
    this.rating = rec?.rating ?? 0;
  };
}
