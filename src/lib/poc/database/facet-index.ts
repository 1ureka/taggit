/**
 * @file facet-index.ts
 * FacetIndex —— 所有查詢用位元圖的維護。
 *
 * - `tagBits`：標籤 → 位元圖（惰性建立，清空即刪除）。
 * - `ratingBits`：評分 0..5 各一張位元圖，讓評分篩選成為 1~6 張位元圖的 OR。
 *
 * 純衍生資料，永不持久化；任何懷疑不一致的場景一律由 store 整體重建。
 * 內部零件，不對 database 模組外露出（外部只透過 Database 的投影原語存取）。
 */

import { BitSet } from "./bitmap.js";
import type { ImageRecord } from "./types.js";

/** 評分的有效範圍：0（未評分）～ 5。 */
const RATING_LEVELS = 6;

export class FacetIndex {
  /** 標籤 → 擁有該標籤的圖片序號位元圖。 */
  readonly tagBits = new Map<string, BitSet>();
  /** 評分 → 該評分的圖片序號位元圖。 */
  private ratingBits: BitSet[] = Array.from({ length: RATING_LEVELS }, () => new BitSet());

  /** 將一筆紀錄的標籤與評分加入索引。 */
  add(ordinal: number, record: ImageRecord): void {
    for (const tag of record.tags) {
      let bits = this.tagBits.get(tag);
      if (!bits) {
        bits = new BitSet();
        this.tagBits.set(tag, bits);
      }
      bits.set(ordinal);
    }

    const rating = this.clampRating(record.rating);
    this.ratingBits[rating].set(ordinal);
  }

  /** 將一筆紀錄的標籤與評分自索引移除。空掉的標籤位元圖一併刪除。 */
  remove(ordinal: number, record: ImageRecord): void {
    for (const tag of record.tags) {
      const bits = this.tagBits.get(tag);
      if (!bits) continue;
      bits.clear(ordinal);
      if (bits.isEmpty()) this.tagBits.delete(tag);
    }

    const rating = this.clampRating(record.rating);
    this.ratingBits[rating].clear(ordinal);
  }

  /** 回傳指定標籤的位元圖，不存在時為 `undefined`。 */
  getTagBits(tag: string): BitSet | undefined {
    return this.tagBits.get(tag);
  }

  /**
   * 回傳評分區間 `[from, to]`（含端點）的聯集位元圖。
   * 區間與有效評分無交集時回傳空位元圖。
   */
  ratingRange(from: number, to: number): BitSet {
    const start = Math.max(0, from);
    const end = Math.min(RATING_LEVELS - 1, to);

    const union = new BitSet();
    for (let r = start; r <= end; r++) {
      union.orInPlace(this.ratingBits[r]);
    }
    return union;
  }

  /** 清空全部索引（重建 / 載入前呼叫）。 */
  clear(): void {
    this.tagBits.clear();
    this.ratingBits = Array.from({ length: RATING_LEVELS }, () => new BitSet());
  }

  /** 將任意評分值收斂至 0..5（防禦壞資料）。 */
  private clampRating(rating: number): number {
    if (!Number.isInteger(rating) || rating < 0) return 0;
    if (rating >= RATING_LEVELS) return RATING_LEVELS - 1;
    return rating;
  }
}
