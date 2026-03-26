import type { ImageWithId } from "$lib/types";
import { imgSrc } from "$lib/client/api.js";
import { blurhashStyle } from "$lib/client/blurhash";

/**
 * EditorPreview 的配置選項
 */
type EditorPreviewOptions = {
  /** 唯讀：目前的圖片紀錄 */
  get currentRecord(): ImageWithId | null;
  /** 圖片切換時呼叫（用於重置縮放等外部動作） */
  onChangeImage: () => void;
};

/**
 * EditorPreview 的無頭 UI
 */
export class EditorPreview {
  /** 預覽圖片的 URL */
  previewSrc: string;
  /** 預覽圖片的樣式 */
  previewStyle: string;
  /** 上一次切換圖片時的 id */
  #prevId: string | null = null;

  constructor(options: EditorPreviewOptions) {
    this.previewSrc = $derived(options.currentRecord ? imgSrc(options.currentRecord.id) : "");

    this.previewStyle = $derived.by(() => {
      const record = options.currentRecord;

      if (!record) {
        return "";
      }

      return blurhashStyle({
        blurhash: record.blurhash,
        width: record.width,
        height: record.height,
        fit: "contain",
      });
    });

    $effect(() => {
      const record = options.currentRecord;
      const id = record ? record.id : null;
      if (id !== this.#prevId) {
        this.#prevId = id;
        options.onChangeImage();
      }
    });
  }
}
