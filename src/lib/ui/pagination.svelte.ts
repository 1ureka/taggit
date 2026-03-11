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
 * 建立分頁邏輯的核心工廠函數
 */
export function createPagination(options: PaginationOptions) {
  /** 處理頁碼按鈕點擊事件，複製當前 URL 參數並切換至指定頁碼 */
  function handlePageClick(p: number) {
    if (p < 1 || p > options.pages) return;
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    goto(`${options.basePath}${qs ? `?${qs}` : ""}`, { noScroll: true, keepFocus: true });
  }

  // ---

  return {
    /** 處理頁碼按鈕點擊事件，複製當前 URL 參數並切換至指定頁碼 */
    handlePageClick,
  };
}
