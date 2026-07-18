/**
 * @file query-union.suite.mjs
 * 標籤聯集張數（Query.unionCount）：單一標籤、重疊聯集、不重疊聯集、
 * 找不到的標籤視為空集合、空陣列、重複名稱冪等，以及純讀取保證
 * （不得改動被聯集標籤自身的位圖）。
 * 執行器見 src/lib/query/index.ts 的 Query.unionCount。
 */

export const name = "tag union count (Query.unionCount)";

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

  t.eq("單一標籤 = 該標籤自身使用數", q.unionCount(["cat"]), 2);
  t.eq("重疊聯集（cat ∪ cats = i1,i2,i3）", q.unionCount(["cat", "cats"]), 3);
  t.eq("不重疊聯集（cute ∪ dog = i1,i4）", q.unionCount(["cute", "dog"]), 2);
  t.eq("找不到的標籤視為空集合", q.unionCount(["ghost"]), 0);
  t.eq("找不到的標籤不影響其餘聯集", q.unionCount(["cat", "ghost"]), 2);
  t.eq("空陣列 = 0", q.unionCount([]), 0);
  t.eq("重複名稱冪等", q.unionCount(["cat", "cat"]), 2);

  // ── 純讀取保證：聯集不得改動被聯集標籤自身的位圖 ──
  q.unionCount(["cat", "cats", "cute"]);
  t.eq("位圖索引未被改動 cat", db.tagCount("cat"), 2);
  t.eq("位圖索引未被改動 cats", db.tagCount("cats"), 2);
  t.eq("位圖索引未被改動 cute", db.tagCount("cute"), 1);
}

export default { name, run };
