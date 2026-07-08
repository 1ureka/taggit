/**
 * @file ordinal.ts
 * OrdinalRegistry —— 字串 ID 與序號（ordinal）的雙向映射。
 *
 * 序號是位元圖使用的稠密整數下標，純屬記憶體、永不持久化：
 * 對外世界（API、URL、db.json）的識別永遠是字串 ID。
 *
 * 刪除採墓碑策略（序號不重用），避免任何懸掛 bit 造成錯配；
 * 墓碑過多時由呼叫端（store）觸發整體重建。
 */

import { BitSet } from "./bitmap.js";

export class OrdinalRegistry {
  /** 序號 → ID；`null` 為墓碑（已刪除，序號不重用）。 */
  private ids: (string | null)[] = [];
  /** ID → 序號。 */
  private map = new Map<string, number>();
  /** 目前存活的序號全集。 */
  private liveBits = new BitSet();
  /** 墓碑數量。 */
  private tombstones = 0;

  /** 目前存活的序號全集（位元圖）。呼叫端不得直接改動。 */
  get live(): BitSet {
    return this.liveBits;
  }

  /** 為新 ID 指派序號。若 ID 已存在則回傳既有序號。 */
  add(id: string): number {
    const existing = this.map.get(id);
    if (existing !== undefined) return existing;

    const ordinal = this.ids.length;
    this.ids.push(id);
    this.map.set(id, ordinal);
    this.liveBits.set(ordinal);
    return ordinal;
  }

  /** 移除 ID，留下墓碑。回傳其序號；ID 不存在時回傳 `undefined`。 */
  remove(id: string): number | undefined {
    const ordinal = this.map.get(id);
    if (ordinal === undefined) return undefined;

    this.ids[ordinal] = null;
    this.map.delete(id);
    this.liveBits.clear(ordinal);
    this.tombstones++;
    return ordinal;
  }

  /** 回傳 ID 的序號，不存在時為 `undefined`。 */
  ordinalOf(id: string): number | undefined {
    return this.map.get(id);
  }

  /** 回傳序號對應的 ID，墓碑或超出範圍時為 `null`。 */
  idOf(ordinal: number): string | null {
    return this.ids[ordinal] ?? null;
  }

  /** 目前存活的 ID 數量。 */
  get liveCount(): number {
    return this.map.size;
  }

  /** 墓碑數超過存活數時，應觸發整體重建（壓實）。 */
  get needsCompaction(): boolean {
    return this.tombstones > this.map.size;
  }

  /** 清空全部狀態（重建 / 載入前呼叫）。 */
  clear(): void {
    this.ids = [];
    this.map.clear();
    this.liveBits = new BitSet();
    this.tombstones = 0;
  }
}
