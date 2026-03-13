import { imgSrc } from "$lib/client/api.js";
import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
import type { ImageWithId } from "$lib/types.js";

/**
 * EditorPreview 元件的配置選項
 */
type EditorPreviewOptions = {
  /** 唯讀：SSR 回傳的圖片資料 */
  get image(): ImageWithId;
  /** 唯讀：操作載入狀態 */
  get loading(): boolean;
};

/**
 * 建立圖片預覽邏輯的核心工廠函數
 */
export function createEditorPreview(options: EditorPreviewOptions) {
  /** zoom-pan 實例 */
  const zp = useZoomPan();

  /** 目前預覽的檔案名稱 */
  const previewFilename = $derived(options.image.id + options.image.ext);
  /** 目前預覽的圖片路徑 */
  const previewSrc = $derived(imgSrc("committed", previewFilename));

  /** 當圖片路徑變更時重置縮放 */
  $effect(() => {
    previewSrc;
    zp.reset();
  });

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

  return {
    /** 存取預覽檔案名稱的 getter */
    get previewFilename() {
      return previewFilename;
    },
    /** 存取預覽圖片路徑的 getter */
    get previewSrc() {
      return previewSrc;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return options.loading;
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
  };
}
