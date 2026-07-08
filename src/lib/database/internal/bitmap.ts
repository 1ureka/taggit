/**
 * @file bitmap.ts
 * BitSet —— 以 `Uint32Array` 為後盾的未壓縮位元圖。
 *
 * 第 n 個 bit 代表序號 n 的圖片是否屬於此集合。
 * 交集 = 逐字 AND、排除 = ANDNOT、計數 = popcount，
 * 一次處理 32 張圖片；faceted search 的熱路徑 {@link BitSet.andSize}
 * 融合 AND + popcount，不配置任何中間集合。
 */

/** 計算 32-bit 整數中 set bit 的數量（SWAR popcount）。 */
function popcount32(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

/**
 * 未壓縮位元圖。容量按需倍增擴容；超出容量的 bit 一律視為 0。
 */
export class BitSet {
  /** 位元字組；第 i 個 bit 位於 `words[i >>> 5]` 的第 `i & 31` 位。 */
  private words: Uint32Array;

  constructor(capacityBits = 0) {
    this.words = new Uint32Array(Math.ceil(capacityBits / 32));
  }

  /** 確保容量至少能容納 `bits` 個 bit，不足時倍增擴容。 */
  ensureCapacity(bits: number): void {
    const needed = Math.ceil(bits / 32);
    if (needed <= this.words.length) return;

    const next = new Uint32Array(Math.max(needed, this.words.length * 2));
    next.set(this.words);
    this.words = next;
  }

  /** 將第 `i` 個 bit 設為 1（自動擴容）。 */
  set(i: number): void {
    this.ensureCapacity(i + 1);
    this.words[i >>> 5] |= 1 << (i & 31);
  }

  /** 將第 `i` 個 bit 清為 0。超出容量時為 no-op。 */
  clear(i: number): void {
    const w = i >>> 5;
    if (w < this.words.length) {
      this.words[w] &= ~(1 << (i & 31));
    }
  }

  /** 回傳第 `i` 個 bit 是否為 1。超出容量時為 false。 */
  has(i: number): boolean {
    const w = i >>> 5;
    return w < this.words.length && ((this.words[w] >>> (i & 31)) & 1) === 1;
  }

  /** set bit 的總數（popcount）。 */
  size(): number {
    let total = 0;
    for (let i = 0; i < this.words.length; i++) {
      total += popcount32(this.words[i]);
    }
    return total;
  }

  /** 是否沒有任何 set bit。 */
  isEmpty(): boolean {
    for (let i = 0; i < this.words.length; i++) {
      if (this.words[i] !== 0) return false;
    }
    return true;
  }

  /** 複製整張位元圖。 */
  clone(): BitSet {
    const copy = new BitSet();
    copy.words = this.words.slice();
    return copy;
  }

  /** 就地交集：`this &= other`。超出 other 容量的部分視為 0（清除）。 */
  andInPlace(other: BitSet): this {
    const min = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < min; i++) this.words[i] &= other.words[i];
    for (let i = min; i < this.words.length; i++) this.words[i] = 0;
    return this;
  }

  /** 就地差集：`this &= ~other`。 */
  andNotInPlace(other: BitSet): this {
    const min = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < min; i++) this.words[i] &= ~other.words[i];
    return this;
  }

  /** 就地聯集：`this |= other`（自動擴容）。 */
  orInPlace(other: BitSet): this {
    this.ensureCapacity(other.words.length * 32);
    for (let i = 0; i < other.words.length; i++) this.words[i] |= other.words[i];
    return this;
  }

  /**
   * `popcount(this AND other)` —— 不配置中間集合的融合運算。
   * faceted search 對每個標籤計數時的熱路徑。
   */
  andSize(other: BitSet): number {
    const min = Math.min(this.words.length, other.words.length);
    let total = 0;
    for (let i = 0; i < min; i++) {
      total += popcount32(this.words[i] & other.words[i]);
    }
    return total;
  }

  /** 依序迭代所有 set bit 的索引（升冪）。 */
  *values(): IterableIterator<number> {
    for (let w = 0; w < this.words.length; w++) {
      let word = this.words[w];
      while (word !== 0) {
        const lsb = word & -word;
        yield (w << 5) + popcount32(lsb - 1);
        word &= word - 1;
      }
    }
  }
}
