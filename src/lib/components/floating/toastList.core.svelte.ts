import { TOAST_ADD, TOAST_PROGRESS_UPDATE, TOAST_PROGRESS_DONE } from "$lib/components/floating/toast-events";
import { TOAST_HISTORY_SHOW, TOAST_HISTORY_HIDE } from "$lib/components/floating/toast-events";
import type { ToastVariant, ToastAddPayload } from "$lib/components/floating/toast-events";
import type { ToastProgressUpdatePayload, ToastProgressDonePayload } from "$lib/components/floating/toast-events";

export interface HistoryItem {
  /** 該項目的識別 id */
  id: number;
  /** 該項目的訊息 */
  message: string;
  /** 該項目的類型 */
  variant: ToastVariant;
  /** 該項目的進度，`undefined` 表示非進度類型 */
  progress?: number;
}

/**
 * 歷史紀錄要保存的數量
 */
const MAX_HISTORY = 10;

/**
 * 全螢幕歷史列表的互動邏輯
 */
export class ToastList {
  /** 獨立於 ToastStage 的 append-only 紀錄，上限 10 筆，不受 stage 自動消失/手動關閉影響 */
  history = $state<HistoryItem[]>([]);
  open = $state(false);

  constructor() {
    $effect(() => {
      const onAdd = (e: Event) => {
        this.#add((e as CustomEvent<ToastAddPayload>).detail);
      };
      const onProgressUpdate = (e: Event) => {
        this.#updateProgress((e as CustomEvent<ToastProgressUpdatePayload>).detail);
      };
      const onProgressDone = (e: Event) => {
        this.#finishProgress((e as CustomEvent<ToastProgressDonePayload>).detail);
      };

      const onShow = () => {
        this.open = true;
      };
      const onHide = () => {
        this.open = false;
      };

      window.addEventListener(TOAST_ADD, onAdd);
      window.addEventListener(TOAST_PROGRESS_UPDATE, onProgressUpdate);
      window.addEventListener(TOAST_PROGRESS_DONE, onProgressDone);
      window.addEventListener(TOAST_HISTORY_SHOW, onShow);
      window.addEventListener(TOAST_HISTORY_HIDE, onHide);

      return () => {
        window.removeEventListener(TOAST_ADD, onAdd);
        window.removeEventListener(TOAST_PROGRESS_UPDATE, onProgressUpdate);
        window.removeEventListener(TOAST_PROGRESS_DONE, onProgressDone);
        window.removeEventListener(TOAST_HISTORY_SHOW, onShow);
        window.removeEventListener(TOAST_HISTORY_HIDE, onHide);
      };
    });
  }

  // ---

  #add(payload: ToastAddPayload) {
    const entry: HistoryItem = { id: payload.id, message: payload.message, variant: payload.variant };
    this.history = [entry, ...this.history].slice(0, MAX_HISTORY);
  }

  #updateProgress(payload: ToastProgressUpdatePayload) {
    this.history = this.history.map((h) =>
      h.id === payload.id ? { ...h, progress: payload.progress, message: payload.message ?? h.message } : h,
    );
  }

  #finishProgress(payload: ToastProgressDonePayload) {
    this.history = this.history.filter((h) => h.id !== payload.id);
  }

  // ---

  dismiss = (id: number) => {
    this.history = this.history.filter((h) => h.id !== id);
  };
}
