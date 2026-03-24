import { untrack } from "svelte";

/**
 * tagger 頁面的配置選項
 */
type TaggerPageOptions = {
  /** 暫存檔案列表 */
  stagedFiles: string[];
};

/**
 * tagger 頁面的頁面級互動邏輯
 */
export class TaggerPage {
  /** 目前選取的檔名 */
  currentFile = $state<string | null>(null);
  /** 已選取的檔名集合 */
  selectedFiles = $state<Set<string>>(new Set());
  /** 已經提交或刪除的項目數量 */
  progress = $state(0);

  constructor(options: TaggerPageOptions) {
    const first = options.stagedFiles[0] ?? null;
    this.currentFile = first;
    this.selectedFiles = first ? new Set([first]) : new Set();

    // 當暫存檔案列表變化或 currentFile 變化時，重新驗證
    $effect(() => {
      const list = options.stagedFiles;

      // 啟用的項目消失時，比如從 0 張變成 N 張，或原本啟用的項目被刪除、提交時
      if (this.currentFile === null && list.length > 0) {
        this.currentFile = list[0];
        this.selectedFiles = new Set([list[0]]);
        return;
      }

      // 啟用的項目仍然存在時，比如從 N 張變成 M 張，或原本啟用的項目其實已不存在時
      if (this.currentFile !== null && list.length > 0) {
        if (!list.includes(this.currentFile)) {
          this.currentFile = list[0];
        }

        const prev = untrack(() => this.selectedFiles);
        const next = new Set([...prev].filter((f) => list.includes(f)));
        if (next.size === 0) {
          this.selectedFiles = new Set([this.currentFile]);
        } else if (next.size !== prev.size) {
          this.selectedFiles = next;
        }

        return;
      }

      // 啟用的項目仍然存在時，比如從 N 張變成 0 張
      if (this.currentFile !== null && list.length <= 0) {
        this.currentFile = null;
        this.selectedFiles = new Set();
        return;
      }
    });
  }
}
