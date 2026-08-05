/**
 * @file suggestions.ts
 * 標籤清理建議引擎：從完整標籤與圖片清單推導可能的清理動作
 */

import type { ImageWithId, Tag } from "$lib/database";

type Suggestion =
  /** 名稱近似：正規化後相同、或編輯距離 1 */
  | { id: string; kind: "similar"; a: Tag; b: Tag; reason: string; both: number }
  /** 高度共現：幾乎總是一起出現的兩個標籤（同義候選） */
  | { id: string; kind: "cooccur"; a: Tag; b: Tag; both: number; jaccard: number }
  /** 冷門標籤：使用數極低，附上最常一起出現的合併候選 */
  | { id: string; kind: "rare"; tag: Tag; topCo: { tag: Tag; both: number } | null }
  /** 零使用標籤：只剩元資料（隱藏設定），沒有任何圖片使用 */
  | { id: string; kind: "unused"; tag: Tag };

const COOCCUR_MIN_BOTH = 3;
const COOCCUR_MIN_JACCARD = 0.6;
const COOCCUR_MAX = 30;
const RARE_MAX_COUNT = 2;
const RARE_MAX = 40;

/** 兩次 yield 之間允許處理的迴圈內層操作數，數字取自「單個 chunk 落在數毫秒等級」的實測結果 */
const YIELD_EVERY = 20_000;

/** 把控制權交還事件迴圈一輪（跳到 check 階段），讓其他排隊中的請求有機會執行 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** 名稱正規化：NFKC（全半形歸一）＋小寫＋移除空白與連接符 */
function normalize(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_]/g, "");
}

/** 兩字串的編輯距離是否 ≤ 1（單趟雙指標，不建 DP 表） */
function withinEditDistance1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (s.length === l.length) i++;
    j++;
  }
  return edits + (l.length - j) <= 1;
}

/** 共現配對 key（名稱排序後以逗號串接；標籤名不可含逗號，故安全） */
const pairKey = (a: string, b: string) => (a < b ? `${a},${b}` : `${b},${a}`);

/**
 * 建立標籤清理建議清單。
 * `images` 需為完整、未經 hidden 遮蔽的原始圖片清單
 * `tags` 需為 `universe: "all"` 的完整標籤清單
 */
export async function buildTagCleanupSuggestions(tags: Tag[], images: ImageWithId[]): Promise<Suggestion[]> {
  const byName = new Map(tags.map((t) => [t.name, t]));
  // 每個標籤只正規化一次，避免在後面的兩兩比對迴圈裡對同一個名稱重複呼叫 normalize()
  const normOf = new Map(tags.map((t) => [t.name, normalize(t.name)]));

  // 共現次數：逐張圖片累計標籤兩兩配對
  const pairCounts = new Map<string, number>();
  let pairOps = 0;
  for (const img of images) {
    const ts = img.tags;
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const key = pairKey(ts[i], ts[j]);
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        if (++pairOps % YIELD_EVERY === 0) await yieldToEventLoop();
      }
    }
  }

  const bothOf = (a: string, b: string) => pairCounts.get(pairKey(a, b)) ?? 0;

  const suggestions: Suggestion[] = [];
  const pairSeen = new Set<string>();

  // 名稱近似

  // 正規化後相同
  const normGroups = new Map<string, string[]>();
  for (const t of tags) {
    const key = normOf.get(t.name)!;
    const arr = normGroups.get(key);
    if (arr) arr.push(t.name);
    else normGroups.set(key, [t.name]);
  }
  for (const group of normGroups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = pairKey(group[i], group[j]);
        pairSeen.add(key);
        suggestions.push({
          id: `similar:${key}`,
          kind: "similar",
          a: byName.get(group[i])!,
          b: byName.get(group[j])!,
          reason: "正規化（大小寫 / 全半形 / 空白連接符）後相同",
          both: bothOf(group[i], group[j]),
        });
      }
    }
  }

  // 編輯距離 1：依正規化名稱首字分桶，控制比較次數
  const buckets = new Map<string, string[]>();
  for (const t of tags) {
    const norm = normOf.get(t.name)!;
    if (norm.length < 4) continue;
    const key = norm[0];
    const arr = buckets.get(key);
    if (arr) arr.push(t.name);
    else buckets.set(key, [t.name]);
  }
  let bucketOps = 0;
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const key = pairKey(bucket[i], bucket[j]);
        if (!pairSeen.has(key) && withinEditDistance1(normOf.get(bucket[i])!, normOf.get(bucket[j])!)) {
          pairSeen.add(key);
          suggestions.push({
            id: `similar:${key}`,
            kind: "similar",
            a: byName.get(bucket[i])!,
            b: byName.get(bucket[j])!,
            reason: "名稱只差一個字元",
            both: bothOf(bucket[i], bucket[j]),
          });
        }
        if (++bucketOps % YIELD_EVERY === 0) await yieldToEventLoop();
      }
    }
  }

  // 高度共現（同義候選）

  const cooccur: Extract<Suggestion, { kind: "cooccur" }>[] = [];
  for (const [key, both] of pairCounts) {
    if (both < COOCCUR_MIN_BOTH) continue;
    if (pairSeen.has(key)) continue;
    const [na, nb] = key.split(",");
    const a = byName.get(na);
    const b = byName.get(nb);
    if (!a || !b) continue;
    const jaccard = both / (a.count + b.count - both);
    if (jaccard < COOCCUR_MIN_JACCARD) continue;
    cooccur.push({ id: `cooccur:${key}`, kind: "cooccur", a, b, both, jaccard });
  }
  cooccur.sort((x, y) => y.jaccard - x.jaccard);
  suggestions.push(...cooccur.slice(0, COOCCUR_MAX));

  // 冷門標籤

  const inSimilar = new Set<string>();
  for (const s of suggestions) {
    if (s.kind === "similar" || s.kind === "cooccur") {
      inSimilar.add(s.a.name);
      inSimilar.add(s.b.name);
    }
  }

  const rare = tags
    .filter((t) => t.count >= 1 && t.count <= RARE_MAX_COUNT && !inSimilar.has(t.name))
    .toSorted((a, b) => a.count - b.count)
    .slice(0, RARE_MAX);

  for (const t of rare) {
    let topCo: { tag: Tag; both: number } | null = null;
    for (const other of tags) {
      if (other.name === t.name || other.count === 0) continue;
      const both = bothOf(t.name, other.name);
      if (both > 0 && (topCo === null || both > topCo.both)) topCo = { tag: other, both };
    }
    suggestions.push({ id: `rare:${t.name}`, kind: "rare", tag: t, topCo });
  }

  //  零使用標籤

  for (const t of tags) {
    if (t.count === 0) suggestions.push({ id: `unused:${t.name}`, kind: "unused", tag: t });
  }

  return suggestions;
}
