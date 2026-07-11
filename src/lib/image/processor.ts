/**
 * @file processor.ts
 * 縮圖產生 —— 依預設尺寸（sm / md）產生 WebP 縮圖，
 * 並透過 LRU 快取與併發任務池（{@link TaskPool}）控制資源使用。
 */

import sharp from "sharp";
import { LRUCache, TaskPool } from "./resources";
import type { ImageSize } from "./formats";

type ProcessableSize = Exclude<ImageSize, "xl">;

const SIZE_PRESETS: Record<ProcessableSize, { maxPixels: number; quality: number }> = {
  sm: { maxPixels: 512 * 512, quality: 80 },
  md: { maxPixels: 1024 * 1024, quality: 90 },
};

/** 計算兩個正整數的最大公因數（輾轉相除法）。 */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * 在不超過 `maxPixels` 的前提下，以整數倍比例縮小尺寸。
 * 若原始尺寸已在範圍內，直接回傳原始寬高。
 */
function thumbnailSize(w: number, h: number, maxPixels: number): { width: number; height: number } {
  if (w * h <= maxPixels) return { width: w, height: h };

  const g = gcd(w, h);
  const bw = w / g;
  const bh = h / g;
  const baseArea = bw * bh;

  let k = Math.floor(Math.sqrt(maxPixels / baseArea));
  while ((k + 1) * (k + 1) * baseArea <= maxPixels) k++;
  k = Math.max(1, k);

  const tw = bw * k;
  const th = bh * k;

  // 當 gcd(w,h) ≈ 1 時，baseArea ≈ w*h > maxPixels → k 被迫為 1 → tw*th = 原始尺寸。
  // 此時改用連續比例縮放作為 fallback，確保結果不超過 maxPixels 太多。
  if (tw * th > maxPixels * 1.5) {
    const ratio = Math.sqrt(maxPixels / (w * h));
    return {
      width: Math.max(1, Math.floor(w * ratio)),
      height: Math.max(1, Math.floor(h * ratio)),
    };
  }

  return { width: tw, height: th };
}

/**
 * 縮圖產生 + 快取 + 併發控制，由 {@link ImageLibrary} 單例內部持有一個實例。
 * 切換 collection 時 `clear()` 整個實例的快取（見 server.ts `ensureActive`）。
 */
export class ImageProcessor {
  private cache: LRUCache;
  private pool: TaskPool;
  private inflight = new Map<string, Promise<Buffer>>();

  constructor(maxBytes: number, concurrency: number) {
    this.cache = new LRUCache(maxBytes);
    this.pool = new TaskPool(concurrency);
  }

  /**
   * 將來源圖片依指定尺寸預設值縮放並轉為 WebP，透過任務池限制併發。
   *
   * 當 `animated` 為 true 且來源為多幀圖片（如 GIF）時，會保留所有影格輸出為
   * 動畫 WebP；否則僅取首格輸出靜態 WebP。`metadata()` 回傳的寬高為單幀尺寸，
   * 故 {@link thumbnailSize} 的計算對動畫與靜態皆適用。
   */
  private async process(sourcePath: string, size: ProcessableSize, animated: boolean): Promise<Buffer> {
    const preset = SIZE_PRESETS[size];
    const input = () => sharp(sourcePath, animated ? { animated: true } : {});

    return this.pool.enqueue(async () => {
      const meta = await sharp(sourcePath).metadata();
      const origW = meta.width ?? 0;
      const origH = meta.height ?? 0;

      if (origW === 0 || origH === 0) {
        return input().webp({ quality: preset.quality }).toBuffer();
      }

      const { width, height } = thumbnailSize(origW, origH, preset.maxPixels);

      if (width === origW && height === origH) {
        return input().webp({ quality: preset.quality }).toBuffer();
      }

      return input().resize(width, height, { fit: "fill" }).webp({ quality: preset.quality }).toBuffer();
    });
  }

  /**
   * 取得指定圖片的縮圖 Buffer（含 LRU 快取與 in-flight 去重）。
   * 若快取命中直接回傳；否則排程產生縮圖後寫入快取。
   *
   * `animated` 版本（動畫 WebP）與靜態版本使用各自獨立的快取鍵，互不覆蓋。
   */
  async get(file: string, sourcePath: string, size: ProcessableSize, animated = false): Promise<Buffer> {
    const cacheKey = `${size}:${animated ? "a" : "s"}:${file}`;

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (this.inflight.has(cacheKey)) return this.inflight.get(cacheKey)!;

    const promise = this.process(sourcePath, size, animated)
      .then((buffer) => {
        this.cache.set(cacheKey, buffer);
        return buffer;
      })
      .finally(() => this.inflight.delete(cacheKey));

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  /** 清空縮圖快取，回傳被清除的項目數量。 */
  clear(): number {
    const count = this.cache.stats.entries;
    this.cache.clear();
    return count;
  }

  /** 取得縮圖快取的統計資訊（項目數量與已使用位元組數）。 */
  stats(): { entries: number; bytes: number } {
    return this.cache.stats;
  }
}
