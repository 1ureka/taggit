/**
 * TaggerProgress 的配置選項
 */
type TaggerProgressOptions = {
  /** 暫存檔案列表 */
  stagedFiles: string[];
  /** 已處理數量 */
  progress: number;
};

/**
 * TaggerProgress 的互動邏輯
 */
export class TaggerProgress {
  /** 總數（已處理 + 剩餘） */
  total: number;
  /** 進度百分比 */
  progressPct: number;
  /** 進度文字標籤 */
  progressLabel: string;

  constructor(options: TaggerProgressOptions) {
    this.total = $derived(options.progress + options.stagedFiles.length);
    this.progressPct = $derived(this.total > 0 ? Math.round((options.progress / this.total) * 100) : 0);
    this.progressLabel = $derived(`${options.progress}/${this.total} (${options.stagedFiles.length} 剩餘)`);
  }
}
