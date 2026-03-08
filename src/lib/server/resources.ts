/** 快取項目，包含原始 Buffer 及其位元組大小 */
type CacheEntry = {
  buffer: Buffer;
  byteSize: number;
};

/**
 * 以位元組為單位的 LRU（最近最少使用）快取。
 * 當快取容量超過上限時，自動淘汰最久未存取的項目。
 */
export class LRUCache {
  /** 有序映射：最近存取的項目在尾部 */
  private map = new Map<string, CacheEntry>();
  /** 當前已使用的位元組數 */
  private currentBytes = 0;
  /** 快取容量上限（位元組） */
  private readonly maxBytes: number;

  /** 建立一個指定最大位元組數的 LRU 快取 */
  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  /**
   * 取得快取中的項目。
   * 若命中，該項目會被移至最新位置（更新 LRU 順序）。
   */
  get(key: string): Buffer | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.buffer;
  }

  /**
   * 寫入快取項目。
   * 若此鍵已存在，則先移除舊項目再重新寫入。
   * 若總容量超過上限，會淘汰最舊的項目直到騰出足夠空間。
   */
  set(key: string, buffer: Buffer): void {
    if (this.map.has(key)) {
      this.currentBytes -= this.map.get(key)!.byteSize;
      this.map.delete(key);
    }

    const byteSize = buffer.byteLength;

    while (this.currentBytes + byteSize > this.maxBytes && this.map.size > 0) {
      const oldest = this.map.keys().next().value!;
      this.currentBytes -= this.map.get(oldest)!.byteSize;
      this.map.delete(oldest);
    }

    this.map.set(key, { buffer, byteSize });
    this.currentBytes += byteSize;
  }

  /** 清空快取，釋放所有項目 */
  clear(): void {
    this.map.clear();
    this.currentBytes = 0;
  }

  /** 取得快取的統計資訊（項目數量與已使用位元組數） */
  get stats() {
    return { entries: this.map.size, bytes: this.currentBytes };
  }
}

/**
 * 固定併發數的非同步任務池。
 * 超過上限的任務會自動排入佇列，待有空閒 slot 時依序執行。
 */
export class TaskPool {
  /** 當前正在執行的任務數 */
  private running = 0;
  /** 等待執行的任務佇列 */
  private queue: Array<() => void> = [];
  /** 最大併發數 */
  private readonly concurrency: number;

  /** 建立一個指定最大併發數的任務池 */
  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  /**
   * 將非同步任務加入併發池。
   * 若當前執行數未達上限，立即執行；否則排入佇列等待。
   * @param fn - 要執行的非同步函數
   * @returns 任務完成後的 Promise
   */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        this.running++;
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          this.running--;
          this.drain();
        }
      };

      if (this.running < this.concurrency) {
        run();
      } else {
        this.queue.push(run);
      }
    });
  }

  /** 排空佇列：當有空閒資源時，依序啟動等待中的任務 */
  private drain() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
  }
}
