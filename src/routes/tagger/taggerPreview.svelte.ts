import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
import { getTaggerContext } from "./context.svelte.js";

/**
 * 建立圖片預覽邏輯的核心工廠函數
 */
export function createTaggerPreview() {
  /** Tagger 頁面共享的 Context */
  const ctx = getTaggerContext();

  /** zoom-pan 實例，同時註冊至 ctx 供其他元件重置 */
  const zp = useZoomPan();
  ctx.zoomPan = zp;

  /** 目前游標所指的檔案名稱 */
  const currentFile = $derived(ctx.cursor >= 0 && ctx.cursor < ctx.list.length ? ctx.list[ctx.cursor] : null);
  /** 預覽圖片的 URL */
  const previewSrc = $derived(currentFile ? `/img/staged/${encodeURIComponent(currentFile)}` : "");
  /** 已選取的圖片數量 */
  const selectedCount = $derived(ctx.selected.size);

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
    ctx.imageLoading = false;
  }

  // ---

  return {
    /** 存取目前檔案名稱的 getter */
    get currentFile() {
      return currentFile;
    },
    /** 存取預覽圖片 URL 的 getter */
    get previewSrc() {
      return previewSrc;
    },
    /** 存取已選取數量的 getter */
    get selectedCount() {
      return selectedCount;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return ctx.loading;
    },
    /** 存取圖片載入狀態的 getter */
    get imageLoading() {
      return ctx.imageLoading;
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
