import { goto } from "$app/navigation";
import { page } from "$app/state";

/**
 * TrashPagination 的配置選項
 */
type TrashPaginationOptions = {
  /** 總頁數 */
  pages: number;
};

/**
 * 建立分頁邏輯的核心工廠函數
 */
export function createTrashPagination(options: TrashPaginationOptions) {
  /** 處理頁碼按鈕點擊事件，複製當前 URL 參數並切換至指定頁碼 */
  function handlePageClick(p: number) {
    if (p < 1 || p > options.pages) return;
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    goto(`/trash${qs ? `?${qs}` : ""}`, { noScroll: true, keepFocus: true });
  }

  // ---

  return {
    /** 處理頁碼按鈕點擊事件，複製當前 URL 參數並切換至指定頁碼 */
    handlePageClick,
  };
}
