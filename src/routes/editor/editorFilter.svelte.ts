import { goto } from "$app/navigation";
import { page } from "$app/state";
import { buildQueryString } from "$lib/database/client.js";

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

  /** 處理篩選表單重置 */
  handleFilterReset = (e: Event) => {
    e.preventDefault();
    const qs = new URLSearchParams(page.url.search);
    const search = buildQueryString({}, qs);
    goto(`${page.url.pathname}${search}`, { replaceState: true, noScroll: true, keepFocus: true });
  };
}
