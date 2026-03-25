import { imgSrc } from "$lib/client/api.js";

/**
 * EditorPreview 的配置選項
 */
type EditorPreviewOptions = {
  /** 唯讀：目前的圖片 id */
  currentId: string | null;
  /** 圖片切換時呼叫（用於重置縮放等外部動作） */
  onChangeImage: () => void;
};

/**
 * EditorPreview 的無頭 UI
 */
export class EditorPreview {
  /** 預覽圖片的 URL */
  previewSrc: string;
  /** 圖片載入狀態 */
  imageLoading = $state(true);

  #prevFile: string | null = null;

  constructor(options: EditorPreviewOptions) {
    this.previewSrc = $derived(options.currentId ? imgSrc(options.currentId) : "");

    $effect(() => {
      const file = options.currentId;
      if (file !== this.#prevFile) {
        if (file) this.imageLoading = true;
        this.#prevFile = file;
        options.onChangeImage();
      }
    });
  }

  // ---

  /** 處理圖片載入完成事件 */
  handleImageLoad = () => {
    this.imageLoading = false;
  };
}
