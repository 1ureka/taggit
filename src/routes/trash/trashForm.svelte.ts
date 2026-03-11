import { goto, invalidateAll, afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import { api } from "$lib/client/api.js";
import { addToast, requestConfirm } from "$lib/client/dom.js";

/**
 * 建立搜尋表單邏輯的核心工廠函數
 */
export function createTrashForm() {
  /** 搜尋文字（從 URL 初始化，使用者輸入時即時更新） */
  let searchText = $state(page.url.searchParams.get("search") ?? "");

  // ---

  /** 搜尋文字 debounce 毫秒數 */
  const SEARCH_DEBOUNCE = 300;

  /** 搜尋文字 debounce 計時器 */
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ---

  /** 組裝 query string 並透過 goto 導航 */
  function navigate(search: string) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    goto(`/trash${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // ---

  /** 處理搜尋輸入框 input 事件，以 debounce 方式觸發導航 */
  function handleSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => navigate(searchText), SEARCH_DEBOUNCE);
  }

  /** 處理還原全部按鈕點擊事件，還原垃圾桶中的所有圖片 */
  async function handleRestoreAllClick() {
    const ok = await requestConfirm("確定要還原垃圾桶中的所有圖片嗎？它們會被移回待審查區。");
    if (!ok) return;

    const res = await api.post<{ restored: number }>("/api/trash");
    if (res.ok) {
      addToast(`已還原 ${res.data?.restored ?? 0} 張圖片`, "success");
    } else {
      addToast("還原失敗: " + (res.error ?? "未知錯誤"), "error");
    }

    await invalidateAll();
  }

  /** 處理清空按鈕點擊事件，永久刪除垃圾桶中的所有圖片 */
  async function handleEmptyTrashClick() {
    const ok = await requestConfirm("確定要清空整個垃圾桶嗎？所有圖片將被永久刪除，此操作無法復原。");
    if (!ok) return;

    const res = await api.del<{ deleted: number }>("/api/trash");
    if (res.ok) {
      addToast(`已清空垃圾桶 (${res.data?.deleted ?? 0} 張)`, "success");
    } else {
      addToast("清空失敗: " + (res.error ?? "未知錯誤"), "error");
    }

    await invalidateAll();
  }

  // ---

  /** 監聽 popstate 導航，從 URL 同步搜尋文字 */
  afterNavigate(({ type }) => {
    if (type === "popstate") {
      searchText = page.url.searchParams.get("search") ?? "";
    }
  });

  // ---

  return {
    /** 存取搜尋文字的 getter */
    get searchText() {
      return searchText;
    },
    /** 設定搜尋文字的 setter */
    set searchText(v: string) {
      searchText = v;
    },

    /** 處理搜尋輸入框 input 事件，以 debounce 方式觸發導航 */
    handleSearchInput,
    /** 處理還原全部按鈕點擊事件，還原垃圾桶中的所有圖片 */
    handleRestoreAllClick,
    /** 處理清空按鈕點擊事件，永久刪除垃圾桶中的所有圖片 */
    handleEmptyTrashClick,
  };
}
