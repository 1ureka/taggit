import { page } from "$app/state";
import { goto, invalidateAll } from "$app/navigation";
import { untrack } from "svelte";
import { api } from "$lib/client/api.js";
import { addToast, requestConfirm } from "$lib/client/dom.js";

/**
 * TrashForm 的互動邏輯
 */
export class TrashForm {
  /** URL 同步鎖：本地正在修改時為 true，跳過外部同步 */
  dirty = $state(false);
  /** 搜尋文字 */
  searchText = $state("");
  /** debounce 計時器 */
  timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.searchText = untrack(() => page.url.searchParams.get("search") ?? "");

    $effect(() => {
      const q = page.url.searchParams.get("search") ?? "";
      if (untrack(() => this.dirty)) return;
      this.searchText = q;
    });
  }

  // ---

  /** 組裝 query string 並透過 goto 導航 */
  #navigate(search: string) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    goto(`/trash${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // ---

  /** 處理搜尋輸入框 input 事件，啟動 debounce 計時 */
  handleSearchInput = () => {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.dirty = false;
      this.#navigate(this.searchText);
    }, 300);
  };

  /** 處理還原全部按鈕點擊事件 */
  handleRestoreAllClick = async () => {
    const ok = await requestConfirm("確定要還原垃圾桶中的所有圖片嗎？它們會被移回待審查區。");
    if (!ok) return;

    const res = await api.post<{ restored: number }>("/api/trash");
    if (res.ok) {
      addToast(`已還原 ${res.data?.restored ?? 0} 張圖片`, "success");
    } else {
      addToast("還原失敗: " + (res.error ?? "未知錯誤"), "error");
    }

    await invalidateAll();
  };

  /** 處理清空按鈕點擊事件 */
  handleEmptyTrashClick = async () => {
    const ok = await requestConfirm("確定要清空整個垃圾桶嗎？所有圖片將被永久刪除，此操作無法復原。");
    if (!ok) return;

    const res = await api.del<{ deleted: number }>("/api/trash");
    if (res.ok) {
      addToast(`已清空垃圾桶 (${res.data?.deleted ?? 0} 張)`, "success");
    } else {
      addToast("清空失敗: " + (res.error ?? "未知錯誤"), "error");
    }

    await invalidateAll();
  };
}
