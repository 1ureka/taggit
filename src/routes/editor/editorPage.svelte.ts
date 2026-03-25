import type { ImageWithId } from "$lib/types.js";
import { goto } from "$app/navigation";
import { untrack } from "svelte";

/**
 * EditorPage 的配置選項
 */
type EditorPageOptions = {
  /** SSR 回傳的 id 列表 */
  imageIds: string[];
  /** SSR 回傳的當前圖片記錄（權威） */
  currentRecord: ImageWithId | null;
};

/**
 * Editor 頁面的頁面級互動邏輯
 */
export class EditorPage {
  /** 已選取的檔名集合（不進 URL，僅前端） */
  selectedFiles = $state<Set<string>>(new Set());
  /** 所有編輯頁面的操作的共用鎖 */
  pending = $state(false);

  constructor(options: EditorPageOptions) {
    // 初始化
    const first = options.currentRecord?.id ?? null;
    this.selectedFiles = first ? new Set([first]) : new Set();

    // SSR 資料變動時的 reconciliation
    $effect(() => {
      const ids = options.imageIds;
      const record = options.currentRecord;
      const currentId = record?.id ?? null;

      if (currentId && ids.length > 0) {
        const prev = untrack(() => this.selectedFiles);
        const next = new Set([...prev].filter((f) => ids.includes(f)));
        if (next.size === 0) {
          this.selectedFiles = new Set([currentId]);
        } else if (next.size !== prev.size) {
          this.selectedFiles = next;
        }
        return;
      }

      if (!currentId || ids.length <= 0) {
        this.selectedFiles = new Set();
        return;
      }
    });
  }

  // ---

  /** 導航到指定檔案（更新 URL 的 currentFile 參數） */
  navigateTo = (filename: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("currentFile", filename);
    goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
  };
}
