/**
 * @file query-tag-counts.suite.mjs
 * 一組指定標籤名稱各自的全域使用數（Query.tagCounts）：單一標籤、多標籤、
 * 找不到的標籤視為 0、空陣列、重複名稱去重，以及純讀取保證
 * （不得改動被查詢標籤自身的位圖）。供 /api/proto/tags-impact 使用。
 * 執行器見 src/lib/query/index.ts 的 Query.tagCounts。
 */

export const name = "tag counts (Query.tagCounts)";

/**
 * fixture：
 *   i1: [cat, cute]   i2: [cats]   i3: [cat, cats]   i4: [dog]
 * cat=2、cats=2、cute=1、dog=1
 */
function seed(h) {
  const db = h.freshDb();
  h.putImage(db, "i1", { tags: ["cat", "cute"] });
  h.putImage(db, "i2", { tags: ["cats"] });
  h.putImage(db, "i3", { tags: ["cat", "cats"] });
  h.putImage(db, "i4", { tags: ["dog"] });
  return db;
}

export async function run(t, h) {
  const { Query } = h.modules;

  const db = seed(h);
  const q = new Query(db);

  const asMap = (res) => Object.fromEntries(res.map((r) => [r.name, r.count]));

  t.eq("單一標籤", asMap(q.tagCounts(["cat"])), { cat: 2 });
  t.eq("多個標籤各自對應正確 count", asMap(q.tagCounts(["cat", "cats", "cute", "dog"])), {
    cat: 2,
    cats: 2,
    cute: 1,
    dog: 1,
  });
  t.eq("找不到的標籤視為 0", asMap(q.tagCounts(["ghost"])), { ghost: 0 });
  t.eq("找不到的標籤不影響其餘結果", asMap(q.tagCounts(["cat", "ghost"])), { cat: 2, ghost: 0 });
  t.eq("空陣列 = 空結果", q.tagCounts([]), []);
  t.eq("重複名稱去重，只回傳一次", q.tagCounts(["cat", "cat"]).length, 1);

  // ── 純讀取保證：查詢不得改動被查詢標籤自身的位圖 ──
  q.tagCounts(["cat", "cats", "cute"]);
  t.eq("位圖索引未被改動 cat", db.tagCount("cat"), 2);
  t.eq("位圖索引未被改動 cats", db.tagCount("cats"), 2);
  t.eq("位圖索引未被改動 cute", db.tagCount("cute"), 1);
}

export default { name, run };
