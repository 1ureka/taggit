/**
 * @file bitmap.suite.mjs
 * BitSet 的位元運算：跨字組邊界、擴容、clone 獨立性、AND/ANDNOT/OR、andSize、values 迭代。
 */

/** 把 BitSet 攤成升冪 index 陣列，便於斷言。 */
const toArr = (bs) => [...bs.values()];

export const name = "bitmap (BitSet)";

export async function run(t, h) {
  const { BitSet } = h.modules;

  // ── set / has / clear ──
  {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    t.ok("set 後 has(0)", bs.has(0));
    t.ok("set 後 has(5)", bs.has(5));
    t.ok("未 set 的 has(3) 為 false", bs.has(3) === false);
    bs.clear(5);
    t.ok("clear(5) 後 has(5) 為 false", bs.has(5) === false);
    t.ok("超出容量的 has(9999) 為 false", bs.has(9999) === false);
  }

  // ── 跨字組邊界的 size 與 values 順序 ──
  {
    const bs = new BitSet();
    for (const i of [0, 31, 32, 63, 64, 100]) bs.set(i);
    t.eq("size 計數跨多個 32-bit 字組", bs.size(), 6);
    t.eq("values 升冪且跨字組正確", toArr(bs), [0, 31, 32, 63, 64, 100]);
  }

  // ── 自動擴容 ──
  {
    const bs = new BitSet(); // 容量 0 起始
    bs.set(1000);
    t.ok("set(1000) 自動擴容後 has(1000)", bs.has(1000));
    t.eq("擴容後 size 為 1", bs.size(), 1);
    t.eq("values 只含 1000", toArr(bs), [1000]);
  }

  // ── isEmpty ──
  {
    const bs = new BitSet();
    t.ok("全新 BitSet isEmpty", bs.isEmpty());
    bs.set(7);
    t.ok("set 後不再 isEmpty", bs.isEmpty() === false);
    bs.clear(7);
    t.ok("clear 回空後 isEmpty", bs.isEmpty());
  }

  // ── clone 獨立性 ──
  {
    const a = new BitSet();
    a.set(1);
    a.set(2);
    const b = a.clone();
    b.set(3);
    a.clear(1);
    t.eq("clone 後改動互不影響（原始）", toArr(a), [2]);
    t.eq("clone 後改動互不影響（複本）", toArr(b), [1, 2, 3]);
  }

  // ── andInPlace：交集，超出 other 容量部分視為 0（清除）──
  {
    const a = new BitSet();
    [1, 2, 3, 100].forEach((i) => a.set(i));
    const b = new BitSet();
    [2, 3, 4].forEach((i) => b.set(i));
    a.andInPlace(b);
    t.eq("andInPlace 取交集且清掉 other 沒有的高位 bit", toArr(a), [2, 3]);
  }

  // ── andNotInPlace：差集 ──
  {
    const a = new BitSet();
    [1, 2, 3, 4].forEach((i) => a.set(i));
    const b = new BitSet();
    [2, 4].forEach((i) => b.set(i));
    a.andNotInPlace(b);
    t.eq("andNotInPlace 取差集", toArr(a), [1, 3]);
  }

  // ── orInPlace：聯集（自動擴容納入 other 的高位 bit）──
  {
    const a = new BitSet();
    a.set(1);
    const b = new BitSet();
    [1, 500].forEach((i) => b.set(i));
    a.orInPlace(b);
    t.eq("orInPlace 聯集並擴容納入高位 bit", toArr(a), [1, 500]);
  }

  // ── andSize：融合 AND + popcount，不改動任一方 ──
  {
    const a = new BitSet();
    [1, 2, 3, 4].forEach((i) => a.set(i));
    const b = new BitSet();
    [3, 4, 5, 6].forEach((i) => b.set(i));
    t.eq("andSize = popcount(a AND b)", a.andSize(b), 2);
    t.eq("andSize 不改動 a", toArr(a), [1, 2, 3, 4]);
    t.eq("andSize 不改動 b", toArr(b), [3, 4, 5, 6]);
    t.eq("與空集的 andSize 為 0", a.andSize(new BitSet()), 0);
  }
}

export default { name, run };
