/**
 * @file projection.suite.mjs
 * 標籤變更集預覽（projectChangeset）：逐標籤現況（exists/count/hidden、meta-only 標籤）、
 * 合併預估（位圖聯集：既存目標、全新目標、多來源同目標）、刪除清空統計
 * （emptiedBy / emptiedTotal），以及純讀取保證（不改動 db 的真相與索引）。
 */

export const name = "tag projection (changeset preview)";

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
  const { projectChangeset, Query } = h.modules;

  const db = seed(h);

  // ── 合併到既存目標：cats -> cat，聯集 i1,i2,i3 = 3 ──
  {
    const p = projectChangeset(db, { deletes: [], renames: [{ from: "cats", to: "cat" }], hidden: [] });
    t.eq("合併後張數 = 位圖聯集大小", p.mergedCounts["cat"], 3);
    t.eq("來源現況 count", p.tags["cats"], { exists: true, count: 2, hidden: false });
    t.eq("目標現況 count", p.tags["cat"], { exists: true, count: 2, hidden: false });
  }

  // ── rename 到全新名稱：目標不存在，張數 = 來源使用數 ──
  {
    const p = projectChangeset(db, { deletes: [], renames: [{ from: "dog", to: "doggo" }], hidden: [] });
    t.eq("改名到新名稱的張數", p.mergedCounts["doggo"], 1);
    t.eq("全新目標 exists=false", p.tags["doggo"].exists, false);
  }

  // ── 多來源指向同一（全新）目標：cat ∪ cats = i1,i2,i3 = 3 ──
  {
    const p = projectChangeset(db, {
      deletes: [],
      renames: [
        { from: "cat", to: "pet" },
        { from: "cats", to: "pet" },
      ],
      hidden: [],
    });
    t.eq("多來源合併聯集", p.mergedCounts["pet"], 3);
  }

  // ── 刪除清空統計：刪 cat+cats → i2(cats)、i3(cat,cats) 全滅；i1 因 cute 倖存 ──
  {
    const p = projectChangeset(db, { deletes: ["cat", "cats"], renames: [], hidden: [] });
    t.eq("emptiedTotal（i2、i3）", p.emptiedTotal, 2);
    t.eq("emptiedBy cat（僅 i3）", p.emptiedBy["cat"], 1);
    t.eq("emptiedBy cats（i2、i3）", p.emptiedBy["cats"], 2);
  }

  // ── 單刪不足以清空時統計為 0 ──
  {
    const p = projectChangeset(db, { deletes: ["cute"], renames: [], hidden: [] });
    t.eq("cute 不會清空任何圖片（i1 還有 cat）", p.emptiedBy["cute"], 0);
    t.eq("emptiedTotal 0", p.emptiedTotal, 0);
  }

  // ── hidden 現況與 meta-only / 不存在標籤 ──
  {
    db.setTagMeta("ghost", { hidden: true });
    const p = projectChangeset(db, {
      deletes: [],
      renames: [],
      hidden: [
        { name: "ghost", hidden: false },
        { name: "nope", hidden: true },
      ],
    });
    t.eq("meta-only 標籤（count 0）exists=true", p.tags["ghost"], { exists: true, count: 0, hidden: true });
    t.eq("完全不存在的標籤", p.tags["nope"], { exists: false, count: 0, hidden: false });
    db.deleteTagMeta("ghost"); // 還原 fixture
  }

  // ── 純讀取保證：預覽不得改動真相與索引（orInPlace 必須從 clone 起算）──
  {
    projectChangeset(db, {
      deletes: ["cat"],
      renames: [
        { from: "cats", to: "cat" },
        { from: "dog", to: "cat" },
      ],
      hidden: [{ name: "cute", hidden: true }],
    });
    const q = new Query(db);
    t.eq("圖片紀錄未被改動", q.getImage("i2").tags, ["cats"]);
    t.eq("位圖索引未被改動 cat", db.tagCount("cat"), 2);
    t.eq("位圖索引未被改動 cats", db.tagCount("cats"), 2);
    t.eq("tagMeta 未被改動", db.getTagMeta("cute").hidden, false);
  }
}

export default { name, run };
