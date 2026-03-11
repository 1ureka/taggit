/**
 * TaggerProgress 元件的配置選項
 */
type TaggerProgressOptions = {
  /** 暫存檔案列表 */
  get stagedFiles(): string[];
  /** 已處理數量 */
  get progress(): number;
};

/**
 * 建立進度列邏輯的核心工廠函數
 */
export function createTaggerProgress(options: TaggerProgressOptions) {
  /** 總數（已處理 + 剩餘） */
  const total = $derived(options.progress + options.stagedFiles.length);
  /** 進度百分比 */
  const progressPct = $derived(total > 0 ? Math.round((options.progress / total) * 100) : 0);
  /** 進度文字標籤 */
  const progressLabel = $derived(`${options.progress}/${total} (${options.stagedFiles.length} 剩餘)`);

  // ---

  return {
    /** 存取進度百分比的 getter */
    get progressPct() {
      return progressPct;
    },
    /** 存取進度文字標籤的 getter */
    get progressLabel() {
      return progressLabel;
    },
  };
}
