import { imgSrc } from "$lib/client/api.js";
import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

/**
 * TaggerPreview 元件的配置選項
 */
type TaggerPreviewOptions = {
  /** 目前選取的檔名 */
  get currentFile(): string | null;
  /** 雙向綁定：圖片載入狀態 */
  get imageLoading(): boolean;
  set imageLoading(v: boolean);
};

/**
 * 建立圖片預覽邏輯的核心工廠函數
 */
export function createTaggerPreview(options: TaggerPreviewOptions) {
  /** zoom-pan 實例 */
  const zp = useZoomPan();
  /** 上一次渲染的檔案名稱，用於偵測檔案切換 */
  let prevFile: string | null = null;

  /** 預覽圖片的 URL */
  const previewSrc = $derived(options.currentFile ? imgSrc("staged", options.currentFile) : "");

  // ---

  /** 處理容器滾輪事件，執行縮放 */
  function handleContainerWheel(e: WheelEvent) {
    zp.onWheel(e);
  }

  /** 處理容器滑鼠按下事件，開始拖曳 */
  function handleContainerMousedown(e: MouseEvent) {
    zp.onMousedown(e);
  }

  /** 處理容器雙擊事件，重置縮放 */
  function handleContainerDblclick() {
    zp.reset();
  }

  // ---

  /** 處理 Window 滑鼠移動事件，更新拖曳位置 */
  function handleWindowMousemove(e: MouseEvent) {
    zp.onWindowMousemove(e);
  }

  /** 處理 Window 滑鼠放開事件，結束拖曳 */
  function handleWindowMouseup() {
    zp.onWindowMouseup();
  }

  // ---

  /** 處理圖片載入完成事件，清除 imageLoading 狀態 */
  function handleImageLoad() {
    options.imageLoading = false;
  }

  // ---

  /** 偵測 currentFile 變更 → imageLoading + zoomPan.reset */
  $effect(() => {
    const file = options.currentFile;
    if (file !== prevFile) {
      if (file) options.imageLoading = true;
      prevFile = file;
      zp.reset();
    }
  });

  // ---

  return {
    /** 存取目前檔案名稱的 getter */
    get currentFile() {
      return options.currentFile;
    },
    /** 存取預覽圖片 URL 的 getter */
    get previewSrc() {
      return previewSrc;
    },
    /** 存取圖片載入狀態的 getter */
    get imageLoading() {
      return options.imageLoading;
    },
    /** 存取 zoom-pan transform 的 getter */
    get transform() {
      return zp.transform;
    },
    /** 存取是否正在拖曳的 getter */
    get isDragging() {
      return zp.isDragging;
    },

    /** 處理容器滾輪事件，執行縮放 */
    handleContainerWheel,
    /** 處理容器滑鼠按下事件，開始拖曳 */
    handleContainerMousedown,
    /** 處理容器雙擊事件，重置縮放 */
    handleContainerDblclick,
    /** 處理 Window 滑鼠移動事件，更新拖曳位置 */
    handleWindowMousemove,
    /** 處理 Window 滑鼠放開事件，結束拖曳 */
    handleWindowMouseup,
    /** 處理圖片載入完成事件，清除 imageLoading 狀態 */
    handleImageLoad,
  };
}
