import { navigating } from "$app/state";
import type { ImageWithId } from "$lib/types.js";

/**
 * ScrollMasonry 的配置選項
 */
type ScrollMasonryOptions = {
  /** 當前頁面的圖片列表 */
  items: ImageWithId[];
};

/**
 * 瀑布流牆的互動邏輯
 */
export class ScrollMasonry {
  /** 是否正在載入中 */
  loading: boolean;
  /** 是否顯示空狀態提示 */
  showEmpty: boolean;

  constructor(options: ScrollMasonryOptions) {
    this.loading = $derived(!!navigating.to);
    this.showEmpty = $derived(options.items.length === 0 && !navigating.to);
  }

  /** 處理圖片雙擊事件，在新分頁打開編輯器 */
  handleImageDblClick = (img: ImageWithId) => {
    window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
  };
}
