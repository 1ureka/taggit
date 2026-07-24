/**
 * @file collection.svelte.ts
 * 圖片集路徑表單 + 路徑歷史瀏覽
 */

import { getContext, setContext } from "svelte";
import { page } from "$app/state";
import { goto } from "$app/navigation";

import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";
import { getPathHistory, pushPathHistory, clearPathHistory } from "./path-history";
import { getPageDataContext } from "./page-data.svelte";

class CollectionController {
  private pageData = getPageDataContext();

  /** 進入歷史瀏覽前，暫存使用者當下輸入，用於回到最新一筆時還原 */
  private draft = "";

  /** 引導 redirect 帶來的提示訊息 */
  alert = $derived.by(() => {
    const kind = page.url.searchParams.get("alert");
    if (kind === "default") return { error: false, message: "尚未設定圖片集路徑，請在下方設定後繼續。" };
    if (kind === "error") return { error: true, message: "設定的路徑無效或無法存取，請重新設定。" };
    return null;
  });

  /** 目前有關歷史紀錄的提示訊息 */
  historyHint = $derived.by(() => {
    if (this.history.length === 0) return "尚無使用紀錄";
    if (this.historyIndex >= 0) return `第 ${this.historyIndex + 1}/${this.history.length} 筆歷史紀錄`;
    return `可用 ↑ / ↓ 切換歷史路徑（共 ${this.history.length} 筆）`;
  });

  /** 目前路徑輸入框內的值 */
  value = $derived(this.pageData.value.collectionRoot);
  /** 是否正在設置新路徑中 */
  pending = $state(false);
  /** 設置後是否有錯誤與錯誤內容 */
  error = $state("");
  /** 曾成功設定過的路徑歷史 */
  history = $state<string[]>(getPathHistory());
  /** 目前瀏覽到的歷史索引，`-1` 表示顯示的是使用者當下輸入 */
  historyIndex = $state(-1);

  private applyHistory = (index: number) => {
    if (index > this.history.length - 1 || index < -1) return;
    this.historyIndex = index;
    this.value = this.history[index];
    this.error = "";
  };

  /** 處理輸入框鍵盤事件 */
  handleKeydown = (e: KeyboardEvent) => {
    if (this.history.length === 0) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();

      if (this.historyIndex === -1) {
        this.draft = this.value;
      }

      this.applyHistory(this.historyIndex + 1);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();

      if (this.historyIndex === 0) {
        // 越過最新一筆，還原使用者原本的輸入
        this.historyIndex = -1;
        this.value = this.draft;
        return;
      }

      this.applyHistory(this.historyIndex - 1);
    }
  };

  /** 處理編輯輸入框事件，脫離歷史瀏覽狀態 */
  handleInput = () => {
    this.historyIndex = -1;
    this.error = "";
  };

  /** 清空所有歷史紀錄；輸入框當下顯示的文字則當成使用者的新草稿 */
  handleClearHistory = () => {
    clearPathHistory();
    this.history = [];
    this.historyIndex = -1;
  };

  private navigate = async () => {
    const url = new URL(location.href);
    url.searchParams.delete("alert");
    await goto(url, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true, state: page.state });
  };

  /** 處理送出更改路徑事件 */
  handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (this.pending) return;

    this.pending = true;
    this.error = "";

    try {
      const root = this.value.trim();
      const res = await api.post("/api/settings/setup", { collectionRoot: root });

      if (!res.ok) {
        this.error = res.error;
        return;
      }

      this.history = pushPathHistory(root);
      this.historyIndex = -1;
      addToast({ message: "圖片集路徑已儲存", variant: "success" });

      await this.navigate();
    } catch (err) {
      this.error = formatError(err);
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("collection-controller");

export const createCollectionContext = () => {
  const controller = new CollectionController();
  setContext(key, controller);
  return controller;
};

export const getCollectionContext = () => getContext<CollectionController>(key);
