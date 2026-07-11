/**
 * @file query-tags.suite.mjs
 * Query 引擎的 tags 分支（不含 hidden；hidden 專屬 hidden.suite.mjs）：
 * 獨立列表（原始計數、count/name 排序、同 count 依 name 升冪 tiebreak）、
 * universe=all 併未使用（count 0）、facets（scope 計數），以及
 * ── 整合 ── 真實 mutation（commit/update/remove 走增量、renameTag/deleteTag 走 rebuild）後，
 * 增量索引（tagCount / sortedTags）於標籤查詢輸出的 count 與排序仍正確。
 */

const FILE = { fileSize: 1, width: 2, height: 3, blurhash: "bh" };

export const name = "query tags (Query engine)";

/** 標籤導向 fixture：apple 與 banana 同為 count 2（測 tie），cherry count 1。 */
function seedTags(h) {
  const db = h.freshDb();
  h.putImage(db, "i1", { name: "I1", tags: ["apple", "banana"] });
  h.putImage(db, "i2", { name: "I2", tags: ["apple", "banana"] });
  h.putImage(db, "i3", { name: "I3", tags: ["cherry"] });
  return db;
}

export async function run(t, h) {
  const { Query, ImageWhere, ListOptions, TagQuery, TagWhere, TagFacetQuery, Mutation } = h.modules;

  const tc = (res) => res.items.map((tg) => `${tg.name}:${tg.count}`);
  const tn = (res) => res.items.map((tg) => tg.name);
  const nameSort = (order) => new ListOptions({ sort: "name", order });

  const db = seedTags(h);
  const q = new Query(db);

  // ── standalone：count = 原始總使用數；count desc、同 count 依 name 升冪 ──
  {
    const res = q.tags(new TagQuery());
    t.eq("standalone count desc，同 count 依 name 升冪", tc(res), ["apple:2", "banana:2", "cherry:1"]);
    t.eq("standalone total", res.total, 3);
  }

  // ── sort=name：預排名稱 + 反轉，不經 Intl tiebreak ──
  {
    t.eq("tags sort=name asc", tn(q.tags(new TagQuery(new TagWhere(), nameSort("asc")))), ["apple", "banana", "cherry"]);
    t.eq("tags sort=name desc", tn(q.tags(new TagQuery(new TagWhere(), nameSort("desc")))), ["cherry", "banana", "apple"]);
  }

  // ── universe=all：併入僅有 metadata、未被使用的標籤（count 0），依名稱插入正確位置 ──
  {
    const used = q.tags(new TagQuery(new TagWhere({ universe: "used" })));
    t.ok("universe=used 不含未使用標籤", used.items.every((tg) => tg.count > 0));

    // 非預設 hidden:true 才會持久化（hidden:false 會被 prune 掉）
    db.setTagMeta("aa", { hidden: true });
    db.setTagMeta("zz", { hidden: true });
    db.setTagMeta("mm", { hidden: true });
    t.eq(
      "count-0 未使用標籤依名稱交錯（sort=name asc）",
      tn(q.tags(new TagQuery(new TagWhere({ universe: "all" }), nameSort("asc")))),
      ["aa", "apple", "banana", "cherry", "mm", "zz"],
    );
    t.eq(
      "count-0 未使用標籤排尾且彼此名稱升冪（sort=count desc）",
      tc(q.tags(new TagQuery(new TagWhere({ universe: "all" })))),
      ["apple:2", "banana:2", "cherry:1", "aa:0", "mm:0", "zz:0"],
    );
    db.deleteTagMeta("aa"); // 還原 fixture
    db.deleteTagMeta("zz");
    db.deleteTagMeta("mm");
  }

  // ── facets：scope 篩選後計數（無 hidden，故 = 交集大小），同 count 依 name 升冪 ──
  {
    const res = q.facets(new TagFacetQuery(new ImageWhere({ includedTags: ["apple"] })));
    t.eq("facet scope=[apple] 計數（apple/banana 同 2 → name 升冪）", tc(res), ["apple:2", "banana:2"]);
    t.ok("facet 過濾掉 count 0 的 cherry", res.items.every((tg) => tg.name !== "cherry"));
  }

  // ══════════════ 整合：真實 mutation 後標籤索引（count/順序）正確 ══════════════

  // ── commit（增量路徑）：建立索引 ──
  {
    const d = h.freshDb();
    const m = new Mutation(d);
    const qq = new Query(d);
    m.commitRecord("a.png", { name: "A", tags: ["cat", "dog"] }, FILE);
    m.commitRecord("b.png", { name: "B", tags: ["cat"] }, FILE);
    t.eq("commit 後 count desc", tc(qq.tags(new TagQuery())), ["cat:2", "dog:1"]);
    t.eq("commit 後 name asc", tn(qq.tags(new TagQuery(new TagWhere(), nameSort("asc")))), ["cat", "dog"]);
  }

  // ── update 改標籤（增量路徑）：拿掉的標籤歸零離開、新標籤插入正確排序位 ──
  {
    const d = h.freshDb();
    const m = new Mutation(d);
    const qq = new Query(d);
    const a = m.commitRecord("a.png", { name: "A", tags: ["cat", "dog"] }, FILE);
    m.commitRecord("b.png", { name: "B", tags: ["dog"] }, FILE); // cat=1[a], dog=2[a,b]
    // a 改成 ["dog","zebra"]：丟掉 cat（→0 應消失）、留 dog、加 zebra
    m.updateRecord("a.png", { expectedUpdatedAt: a.data.updatedAt, tags: ["dog", "zebra"] });
    t.eq("update 後 cat 歸零離開、zebra 併入（count desc）", tc(qq.tags(new TagQuery())), ["dog:2", "zebra:1"]);
    t.eq("update 後有序名單不含 cat、含 zebra（name asc）", tn(qq.tags(new TagQuery(new TagWhere(), nameSort("asc")))), ["dog", "zebra"]);
  }

  // ── renameTag（rebuild 路徑）：舊名消失、新名以合併計數落在正確排序位 ──
  {
    const d = h.freshDb();
    const m = new Mutation(d);
    const qq = new Query(d);
    m.commitRecord("a.png", { name: "A", tags: ["cat", "cute"] }, FILE);
    m.commitRecord("b.png", { name: "B", tags: ["cat"] }, FILE);
    m.commitRecord("c.png", { name: "C", tags: ["dog"] }, FILE); // cat=2, cute=1, dog=1
    m.renameTag("cat", "aardvark"); // 改成會排到最前的名字，驗排序位重建
    t.eq("rename 後新名合併計數、排序位正確（count desc）", tc(qq.tags(new TagQuery())), ["aardvark:2", "cute:1", "dog:1"]);
    t.eq("rename 後 rebuild 出正確名稱序（aardvark 落到最前）", tn(qq.tags(new TagQuery(new TagWhere(), nameSort("asc")))), ["aardvark", "cute", "dog"]);
  }

  // ── deleteTag（rebuild 路徑）：標籤自 count/有序名單雙雙消失 ──
  {
    const d = h.freshDb();
    const m = new Mutation(d);
    const qq = new Query(d);
    m.commitRecord("a.png", { name: "A", tags: ["cat", "cute"] }, FILE);
    m.commitRecord("b.png", { name: "B", tags: ["cat", "fluffy"] }, FILE); // cat=2, cute=1, fluffy=1
    m.deleteTag("cat");
    t.eq("deleteTag 後 cat 自 count 消失", tc(qq.tags(new TagQuery())), ["cute:1", "fluffy:1"]);
    t.eq("deleteTag 後 cat 自有序名單消失（name asc）", tn(qq.tags(new TagQuery(new TagWhere(), nameSort("asc")))), ["cute", "fluffy"]);
  }

  // ── remove 圖片（增量路徑）：受影響標籤遞減、歸零者離開有序名單 ──
  {
    const d = h.freshDb();
    const m = new Mutation(d);
    const qq = new Query(d);
    m.commitRecord("a.png", { name: "A", tags: ["cat", "dog"] }, FILE);
    m.commitRecord("b.png", { name: "B", tags: ["cat"] }, FILE); // cat=2, dog=1
    m.removeRecord("a.png"); // cat=1[b]，dog=0 應消失
    t.eq("remove 後 dog 歸零離開、cat 遞減（count desc）", tc(qq.tags(new TagQuery())), ["cat:1"]);
    t.eq("remove 後有序名單不含 dog（name asc）", tn(qq.tags(new TagQuery(new TagWhere(), nameSort("asc")))), ["cat"]);
  }
}

export default { name, run };
