const EMPTY = Symbol("empty");

/**
 * 基於 requestAnimationFrame 的事件聚合器
 *
 * 將高頻率事件（滾動、縮放）聚合並限制回呼執行頻率，
 * 超過空閒時間後自動停止 tick 循環以節省資源。
 */
export class RAFAggregator {
  private buffer: typeof EMPTY | true = EMPTY;
  private lastRunTime = 0;
  private lastUpdateTime = 0;
  private rafId: number | null = null;
  private readonly interval: number;
  private readonly idleTimeout: number;

  constructor(
    private readonly callback: () => void,
    options: { fps?: number; idleTimeout?: number } = {},
  ) {
    this.interval = 1000 / (options.fps || 60);
    this.idleTimeout = options.idleTimeout ?? 500;
  }

  /** 通知有新事件發生，啟動或延續 RAF 循環 */
  notify() {
    this.lastUpdateTime = performance.now();
    this.buffer = true;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (timestamp: number) => {
    if (timestamp - this.lastRunTime >= this.interval && this.buffer !== EMPTY) {
      this.callback();
      this.buffer = EMPTY;
      this.lastRunTime = timestamp;
    }

    if (timestamp - this.lastUpdateTime >= this.idleTimeout) {
      this.dispose();
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /** 停止 RAF 循環 */
  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
