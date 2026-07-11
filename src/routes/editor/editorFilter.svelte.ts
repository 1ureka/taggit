import { goto } from "$app/navigation";
import { page } from "$app/state";
import { ImageQuery } from "$lib/query-spec";

/**
 * 篩選對話框的互動邏輯
 */
export class EditorFilterModal {
  /** 篩選對話框是否開啟 */
  open = $state(false);

  /** 打開篩選對話框 */
  handleOpenFilter = () => {
    this.open = true;
  };

  /** 關閉篩選對話框 */
  handleCloseFilter = () => {
    this.open = false;
  };

  /** 處理篩選表單重置：以預設查詢覆蓋（清掉全部查詢鍵），保留頁面自有參數（如 currentId） */
  handleFilterReset = (e: Event) => {
    e.preventDefault();
    const params = new ImageQuery().toSearchParams(page.url.searchParams);
    const qs = params.toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };
}
