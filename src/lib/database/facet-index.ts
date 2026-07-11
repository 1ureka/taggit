/**
 * @file facet-index.ts
 * 所有查詢用位元圖的維護。
 *
 * - `tagBits`：標籤 → 位元圖（惰性建立，清空即刪除）。
 * - `ratingBits`：評分 0..5 各一張位元圖，讓評分篩選成為 1~6 張位元圖的 OR。
 */

import { BitSet } from "./bitmap";
import { sortCollator } from "$lib/utils/shared";
import type { ImageRecord } from "./types";

/** 評分的有效範圍：0（未評分）～ 5。 */
const RATING_LEVELS = 6;

export class FacetIndex {
  /** 標籤 → 擁有該標籤的圖片序號位元圖。 */
  readonly tagBits = new Map<string, BitSet>();
  /** 標籤 → 使用數（= 該標籤位元圖的 set bit 數）讓標準列表查詢免去每標籤全位元圖 popcount。 */
  private tagCounts = new Map<string, number>();
  /** 目前被使用的標籤名稱，依 {@link sortCollator} 升冪維護。 */
  private sortedNames: string[] = [];
  /** 評分 → 該評分的圖片序號位元圖。 */
  private ratingBits: BitSet[] = Array.from({ length: RATING_LEVELS }, () => new BitSet());

  // ---

  /** 將一筆紀錄的標籤與評分加入索引。 */
  add(ordinal: number, record: ImageRecord): void {
    for (const tag of record.tags) {
      let bits = this.tagBits.get(tag);

      if (!bits) {
        bits = new BitSet();
        this.tagBits.set(tag, bits);
        this.insertSortedName(tag);
      }

      if (!bits.has(ordinal)) {
        bits.set(ordinal);
        this.tagCounts.set(tag, (this.tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const rating = this.clampRating(record.rating);
    this.ratingBits[rating].set(ordinal);
  }

  /** 將一筆紀錄的標籤與評分自索引移除。空掉的標籤位元圖一併刪除。 */
  remove(ordinal: number, record: ImageRecord): void {
    for (const tag of record.tags) {
      const bits = this.tagBits.get(tag);
      if (!bits) continue;

      if (bits.has(ordinal)) {
        bits.clear(ordinal);
        const next = (this.tagCounts.get(tag) ?? 1) - 1;
        if (next <= 0) this.tagCounts.delete(tag);
        else this.tagCounts.set(tag, next);
      }

      if (bits.isEmpty()) {
        this.tagBits.delete(tag);
        this.removeSortedName(tag);
      }
    }

    const rating = this.clampRating(record.rating);
    this.ratingBits[rating].clear(ordinal);
  }

  /** 清空全部索引（重建 / 載入前呼叫）。 */
  clear(): void {
    this.tagBits.clear();
    this.tagCounts.clear();
    this.sortedNames = [];
    this.ratingBits = Array.from({ length: RATING_LEVELS }, () => new BitSet());
  }

  // ---

  /** 回傳指定標籤的位元圖，不存在時為 `undefined`。 */
  getTagBits(tag: string): BitSet | undefined {
    return this.tagBits.get(tag);
  }

  /** 回傳指定標籤的使用數（O(1)），不存在時為 0。等同 `getTagBits(tag)?.size() ?? 0`。 */
  getTagCount(tag: string): number {
    return this.tagCounts.get(tag) ?? 0;
  }

  /** 目前被使用的標籤名稱，依 sortCollator 升冪。 */
  getSortedTags(): readonly string[] {
    return this.sortedNames;
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

  // ---

  /** 二分插入名稱至 sortedNames，維持升冪。 */
  private insertSortedName(name: string): void {
    this.sortedNames.splice(this.lowerBound(name), 0, name);
  }

  /** 二分移除名稱（存在才移除）。 */
  private removeSortedName(name: string): void {
    const i = this.lowerBound(name);
    if (this.sortedNames[i] === name) this.sortedNames.splice(i, 1);
  }

  /** sortedNames 中第一個「不小於 name」的位置（依 sortCollator）。 */
  private lowerBound(name: string): number {
    let lo = 0;
    let hi = this.sortedNames.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sortCollator.compare(this.sortedNames[mid], name) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // ---

  /** 將任意評分值收斂至 0..5（防禦壞資料）。 */
  private clampRating(rating: number): number {
    if (!Number.isInteger(rating) || rating < 0) return 0;
    if (rating >= RATING_LEVELS) return RATING_LEVELS - 1;
    return rating;
  }
}
