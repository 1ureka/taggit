import { goto } from "$app/navigation";
import { page } from "$app/state";

/**
 * Pagination 的配置選項
 */
type PaginationOptions = {
  /** 總頁數 */
  pages: number;
  /** 導航的基礎路徑（如 "/editor"、"/trash"） */
  basePath: string;
};

/**
 * 分頁元件的互動邏輯
 */
export class Pagination {
  constructor(private options: PaginationOptions) {}

  // ---

  /** 處理頁碼按鈕點擊事件，複製當前 URL 參數並切換至指定頁碼 */
  handlePageClick = (p: number) => {
    if (p < 1 || p > this.options.pages) return;
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    goto(`${this.options.basePath}${qs ? `?${qs}` : ""}`, { noScroll: true, keepFocus: true });
  };
}
