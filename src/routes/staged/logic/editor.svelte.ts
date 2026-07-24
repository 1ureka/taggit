/**
 * @file editor.svelte.ts
 * 暫存草稿的本地狀態、目前編輯中的檔案，以及清空／刪除與離頁守衛
 */

import type { BeforeNavigate } from "@sveltejs/kit";
import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

import { emptyDraft, isTouched, problemOf, type Draft } from "./draft";
import { getPageDataContext } from "./page-data.svelte";
import { getOperationsContext } from "./operations.svelte";

/** 未建立草稿的檔案共用此唯讀空白草稿（僅供顯示，不可被寫入） */
const EMPTY_DRAFT: Draft = emptyDraft();

class EditorController {
  private pageData = getPageDataContext();
  private operations = getOperationsContext();

  /** 每張暫存圖片的本地草稿，只在選檔當下延遲建立，不主動清除失效 key */
  private drafts = $state<Record<string, Draft>>({});
  /** 目前編輯中的暫存圖片，使用者的原始意圖，不主動清除 */
  private active = $state<string | null>(null);

  private get files() {
    return this.pageData.value.stagedFiles;
  }

  /** 被編輯過的暫存圖片 */
  touchedFiles = $derived(this.files.filter((f) => this.drafts[f] && isTouched(this.drafts[f])));
  /** 被編輯過且可提交的張數 */
  readyCount = $derived(this.touchedFiles.filter((f) => problemOf(this.drafts[f]) === null).length);
  /** 目前編輯中的暫存圖片；檔案被提交／刪除而離開清單時自動回落為 null */
  activeFile = $derived(this.active !== null && this.files.includes(this.active) ? this.active : null);
  /** 目前編輯中的暫存圖片指標（1-based） */
  activeIndex = $derived(this.activeFile !== null ? this.files.indexOf(this.activeFile) + 1 : 0);
  /** 目前編輯中的草稿；Inspector 以此（存在與否）決定是否顯示 */
  activeDraft = $derived(this.activeFile !== null ? this.drafts[this.activeFile] : undefined);

  /** 指定檔名的草稿，尚未建立時回傳共用空白草稿 */
  draftOf = (filename: string): Draft => this.drafts[filename] ?? EMPTY_DRAFT;
  /** 指定檔名是否為目前編輯中 */
  isActive = (filename: string) => this.activeFile === filename;
  /** 覆寫指定檔案的草稿，尚未建立過草稿的檔案會直接建立 */
  writeDraft = (filename: string, draft: Draft) => {
    this.drafts[filename] = draft;
  };

  private setActive(file: string | null) {
    if (file !== null) this.drafts[file] ??= emptyDraft();
    this.active = file;
  }

  /** 開啟指定檔案的編輯面板 */
  handleSelect = (file: string) => {
    this.setActive(file);
  };

  /** 關閉編輯面板 */
  handleClose = () => {
    this.setActive(null);
  };

  /** 清空目前編輯中的草稿 */
  handleClear = () => {
    if (this.activeFile === null) return;
    this.drafts[this.activeFile] = emptyDraft();
  };

  /** 移除指定的檔案草稿 */
  removeDrafts = (filenames: string[]) => {
    for (const f of filenames) delete this.drafts[f];
  };

  /** 永久刪除目前編輯中的檔案 */
  handleDelete = async () => {
    const file = this.activeFile;
    if (file === null || this.operations.pending) return;

    const msg = `確定要永久刪除 ${file}？此操作無法復原。`;
    if (!(await requestConfirm(msg, { title: "永久刪除", action: "永久刪除" }))) return;

    const idx = this.files.indexOf(file);
    const next = this.files[idx + 1] ?? this.files[idx - 1] ?? null;

    this.operations.pending = true;
    try {
      const res = await api.del(`/api/staged/${encodeURIComponent(file)}`);
      if (!res.ok) {
        addToast({ message: `刪除失敗: ${res.error}`, variant: "error" });
        return;
      }

      delete this.drafts[file];
      this.setActive(next);
      addToast({ message: `已永久刪除：${file}`, variant: "info" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: "刪除失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.operations.pending = false;
    }
  };

  /** 客戶端導航離頁守衛 */
  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 自身的同址 goto with invalidate 不攔

    if (this.operations.pending) {
      nav.cancel(); // 避免 in-flight 續跑在新頁面上產生跨頁副作用
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    if (this.touchedFiles.length === 0) return; // 有未提交變更時要求二次確認，確認後清空草稿再放行

    nav.cancel();
    if (to === null) return;

    const msg = `還有 ${this.touchedFiles.length} 張圖片的暫存尚未提交，離開將會遺失這些修改。確定要離開？`;
    requestConfirm(msg, { title: "尚未提交的變更", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.drafts = {};
      goto(to.url.href);
    });
  };

  /** 卸載／重新整理整頁前的守衛：有未提交變更或操作進行中時提示 */
  handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.touchedFiles.length > 0 || this.operations.pending) {
      e.preventDefault();
      e.returnValue = ""; // 部分瀏覽器需一併設定才會顯示離開確認
    }
  };
}

const key = Symbol("editor-controller");

export const createEditorContext = () => {
  const controller = new EditorController();
  setContext(key, controller);
  return controller;
};

export const getEditorContext = () => getContext<EditorController>(key);
