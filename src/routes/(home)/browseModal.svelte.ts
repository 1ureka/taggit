import { pushState } from "$app/navigation";
import { page } from "$app/state";
import type { ImageWithId } from "$lib/types.js";

type BrowseModalOptions = {
  /** SSR 的圖片集合結果 */
  get items(): ImageWithId[];
};

export class BrowseModal {
  /** 目前顯示的圖片紀錄，若沒有選擇圖片或圖片不存在則為 null，代表不要開啟對話框 */
  record: ImageWithId | null;

  constructor(options: BrowseModalOptions) {
    this.record = $derived.by(() => {
      // 第一個取值是為了 SSR，第二個取值是為了 CSR (shallow routing)
      const modal = page.url.searchParams.get("modal") || (page.state as { modal?: string }).modal;
      if (!modal) return null;

      const record = options.items.find((item) => item.id === modal) || null;
      return record;
    });
  }

  /** 處理 Trigger 點擊事件 */
  handleTriggerClick = (id: string) => {
    const params = new URLSearchParams(page.url.searchParams);
    params.set("modal", id);
    pushState(`/?${params.toString()}`, { modal: id });
  };

  /** 關閉 Modal，從 URL 移除 ?modal，也就是回到上一個 URL 狀態 */
  handleClose = () => {
    // 確保真的有打開，才允許關閉（回到上一個 URL 狀態）
    if (this.record) history.back();
  };
}
