import { imgSrc } from "$lib/client/api.js";

/**
 * TaggerPreview 的配置選項
 */
type TaggerPreviewOptions = {
  /** 唯讀：目前選取的檔名 */
  get currentFile(): string | null;
  /** 圖片切換時呼叫（用於重置縮放等外部動作） */
  onChangeImage: () => void;
};

/**
 * TaggerPreview 的無頭 UI
 */
export class TaggerPreview {
  /** 預覽圖片的 URL */
  previewSrc: string;
  /** 圖片載入狀態 */
  imageLoading = $state(false);

  #prevFile: string | null = null;

  constructor(options: TaggerPreviewOptions) {
    this.previewSrc = $derived(options.currentFile ? imgSrc(options.currentFile) : "");

    $effect(() => {
      const file = options.currentFile;
      if (file !== this.#prevFile) {
        if (file) this.imageLoading = true;
        this.#prevFile = file;
        options.onChangeImage();
      }
    });
  }

  // ---

  /** 處理圖片載入完成事件，清除 imageLoading 狀態 */
  handleImageLoad = () => {
    this.imageLoading = false;
  };
}
