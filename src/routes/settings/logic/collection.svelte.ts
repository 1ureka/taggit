/**
 * @file collection.svelte.ts
 * 圖片集路徑表單 + 路徑歷史瀏覽
 */

import { getContext, setContext } from "svelte";
import { page } from "$app/state";
import { goto } from "$app/navigation";
import { api } from "$lib/utils/request";

import { getPathHistory, pushPathHistory, clearPathHistory } from "../storage/path-history";
import { addToast } from "$lib/components/floating/toast-events";
import { getPageDataContext } from "./page-data.svelte";

class CollectionController {
  private pageData = getPageDataContext();

  /** 引導 redirect 帶來的提示訊息 */
  alert = $derived.by(() => {
    const kind = page.url.searchParams.get("alert");
    if (kind === "default") return { error: false, message: "尚未設定圖片集路徑，請在下方設定後繼續。" };
    if (kind === "error") return { error: true, message: "設定的路徑無效或無法存取，請重新設定。" };
    return null;
  });

  // 可覆寫的 derived，使用者輸入時覆寫，load 重跑後回到伺服器值
  inputValue = $derived(this.pageData.value.collectionRoot);
  saving = $state(false);
  errorMessage = $state("");

  /** 曾成功設定過的路徑歷史（最近優先） */
  history = $state<string[]>(getPathHistory());
  /** 目前瀏覽到的歷史索引；`-1` 表示未在瀏覽歷史（顯示的是使用者當下輸入） */
  historyIndex = $state(-1);
  /** 進入歷史瀏覽前，暫存使用者當下輸入，供 ArrowDown 越過最新一筆時還原 */
  private draft = "";

  historyHint = $derived.by(() => {
    if (this.history.length === 0) return "尚無使用紀錄";
    if (this.historyIndex >= 0) return `第 ${this.historyIndex + 1}/${this.history.length} 筆歷史紀錄`;
    return `可用 ↑ / ↓ 切換歷史路徑（共 ${this.history.length} 筆）`;
  });

  private applyHistory = (index: number) => {
    this.historyIndex = index;
    this.inputValue = this.history[index];
  };

  handleKeydown = (e: KeyboardEvent) => {
    if (this.history.length === 0) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      // 從當下輸入進入歷史時，先暫存草稿以便日後還原
      if (this.historyIndex === -1) this.draft = this.inputValue;
      this.applyHistory(Math.min(this.historyIndex + 1, this.history.length - 1));
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.historyIndex <= -1) return;
      if (this.historyIndex === 0) {
        // 越過最新一筆，還原使用者原本的輸入
        this.historyIndex = -1;
        this.inputValue = this.draft;
        return;
      }
      this.applyHistory(this.historyIndex - 1);
    }
  };

  /** 使用者手動編輯輸入框時，脫離歷史瀏覽狀態 */
  handleInput = () => {
    this.historyIndex = -1;
    this.errorMessage = "";
  };

  /**
   * 清空所有歷史紀錄；輸入框當下顯示的文字（不論是否正在瀏覽歷史）直接當成使用者的新草稿，不做還原
   */
  handleClearHistory = () => {
    clearPathHistory();
    this.history = [];
    this.historyIndex = -1;
  };

  handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (this.saving) return;

    this.saving = true;
    this.errorMessage = "";

    const root = this.inputValue.trim();
    try {
      const res = await api.post("/api/settings/setup", { collectionRoot: root });
      if (res.ok) {
        this.history = pushPathHistory(root);
        this.historyIndex = -1;
        addToast({ message: "圖片集路徑已儲存", variant: "success" });

        const url = new URL(location.href);
        url.searchParams.delete("alert");
        await goto(url, {
          replaceState: true,
          noScroll: true,
          keepFocus: true,
          invalidateAll: true,
          state: page.state,
        });
      } else {
        this.errorMessage = res.error ?? "未知錯誤";
      }
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : "未知錯誤";
    } finally {
      this.saving = false;
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
