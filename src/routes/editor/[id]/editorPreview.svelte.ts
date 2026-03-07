import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
import { getEditorDetailContext } from "./context.svelte.js";

/**
 * 建立圖片預覽邏輯的核心工廠函數
 */
export function createEditorPreview() {
  /** Editor 詳細編輯頁面共享的 Context */
  const ctx = getEditorDetailContext();

  /** 目前預覽的檔案名稱 */
  const previewFilename = $derived(ctx.image ? ctx.image.id + ctx.image.ext : null);
  /** 目前預覽的圖片路徑 */
  const previewSrc = $derived(previewFilename ? `/img/committed/${previewFilename}` : "");

  // ---

  /** 縮放平移控制器 */
  const zp = useZoomPan();

  /** 當圖片路徑變更時重置縮放 */
  $effect(() => {
    previewSrc;
    zp.reset();
  });

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
    /** 存取縮放平移控制器的 getter */
    get zp() {
      return zp;
    },
  };
}
