/**
 * @file query.suite.mjs
 * Query 引擎（不含 hidden；hidden 專屬 hidden.suite.mjs）：
 * images 篩選（AND/NOT/rating/search）、排序（name/rating/committedAt/tie-break）、分頁、
 * tags 獨立列表（原始計數 + universe=all 併未使用）、facets（scope 計數）、單張存取。
 */

export const name = "query (Query engine)";

/** 建構含 4 張圖的固定 fixture（無 hidden 標籤）。 */
function seed(h) {
  const db = h.freshDb();
  h.putImage(db, "p1", { name: "Apple", tags: ["fruit", "red"], rating: 5, committedAt: 100 });
  h.putImage(db, "p2", { name: "Banana", tags: ["fruit"], rating: 3, committedAt: 200 });
  h.putImage(db, "p3", { name: "Cherry", tags: ["fruit", "red"], rating: 5, committedAt: 300 });
  h.putImage(db, "p4", { name: "Date", tags: ["dry"], rating: 1, committedAt: 400 });
  return db;
}

export async function run(t, h) {
  const { Query, ImageQuery, ImageWhere, ListOptions, TagQuery, TagWhere, TagFacetQuery } = h.modules;
  const db = seed(h);
  const q = new Query(db);

  const ids = (res) => res.items.map((i) => i.id);
  const names = (res) => res.items.map((i) => i.name);
  const imgWhere = (over) => new ImageWhere(over);
  const imgQuery = (where, list) => new ImageQuery(where, list);
  const list = (over) => new ListOptions({ sort: "rating", order: "desc", ...over });

  // ── 預設查詢：rating desc；tie-break 沿用 order（desc → name desc）──
  {
    const res = q.images(new ImageQuery());
    t.eq("預設排序 rating desc，同分 name 亦 desc（Cherry 先於 Apple）", ids(res), ["p3", "p1", "p2", "p4"]);
    t.eq("total 反映全體", res.total, 4);
    t.eq("不分頁時 pages 1", res.pages, 1);
  }

  // ── includedTags：AND ──
  {
    t.eq("includedTags=[fruit]（rating desc，同分 name desc）", ids(q.images(imgQuery(imgWhere({ includedTags: ["fruit"] })))), ["p3", "p1", "p2"]);
    t.eq("includedTags=[fruit,red] 交集", ids(q.images(imgQuery(imgWhere({ includedTags: ["fruit", "red"] })))), ["p3", "p1"]);
    t.eq("includedTags 不存在標籤 → 空", ids(q.images(imgQuery(imgWhere({ includedTags: ["ghost"] })))), []);
  }

  // ── excludedTags：NOT ──
  {
    t.eq("excludedTags=[red]", ids(q.images(imgQuery(imgWhere({ excludedTags: ["red"] })))), ["p2", "p4"]);
  }

  // ── rating gte / lte / eq ──
  {
    t.eq("rating gte 5（同分 name desc）", ids(q.images(imgQuery(imgWhere({ rating: 5, ratingOp: "gte" })))), ["p3", "p1"]);
    t.eq("rating lte 1", ids(q.images(imgQuery(imgWhere({ rating: 1, ratingOp: "lte" })))), ["p4"]);
    t.eq("rating eq 3", ids(q.images(imgQuery(imgWhere({ rating: 3, ratingOp: "eq" })))), ["p2"]);
  }

  // ── search：名稱子字串（大小寫無關）──
  {
    t.eq("search 'rr' 只中 Cherry", ids(q.images(imgQuery(imgWhere({ search: "rr" })))), ["p3"]);
    t.eq("search 'an' 只中 Banana", ids(q.images(imgQuery(imgWhere({ search: "AN" })))), ["p2"]);
    t.eq("search 無命中 → 空", ids(q.images(imgQuery(imgWhere({ search: "zzz" })))), []);
  }

  // ── 排序軸 ──
  {
    t.eq("sort name asc", names(q.images(imgQuery(imgWhere(), list({ sort: "name", order: "asc" })))), ["Apple", "Banana", "Cherry", "Date"]);
    t.eq("sort name desc", names(q.images(imgQuery(imgWhere(), list({ sort: "name", order: "desc" })))), ["Date", "Cherry", "Banana", "Apple"]);
    t.eq("sort committedAt asc", ids(q.images(imgQuery(imgWhere(), list({ sort: "committedAt", order: "asc" })))), ["p1", "p2", "p3", "p4"]);
    t.eq("sort committedAt desc", ids(q.images(imgQuery(imgWhere(), list({ sort: "committedAt", order: "desc" })))), ["p4", "p3", "p2", "p1"]);
    t.eq("sort rating asc tie-break name asc", ids(q.images(imgQuery(imgWhere(), list({ sort: "rating", order: "asc" })))), ["p4", "p2", "p1", "p3"]);
  }

  // ── random 排序：集合不變、僅順序打亂（驗集合） ──
  {
    const res = q.images(imgQuery(imgWhere(), list({ sort: "random" })));
    t.eq("random 排序保留全體集合", ids(res).slice().sort(), ["p1", "p2", "p3", "p4"]);
  }

  // ── 分頁 ──
  {
    const page1 = q.images(imgQuery(imgWhere(), list({ sort: "rating", order: "desc", limit: 2, page: 1 })));
    t.eq("limit2 page1 items", ids(page1), ["p3", "p1"]);
    t.eq("limit2 total", page1.total, 4);
    t.eq("limit2 pages", page1.pages, 2);
    const page2 = q.images(imgQuery(imgWhere(), list({ sort: "rating", order: "desc", limit: 2, page: 2 })));
    t.eq("limit2 page2 items", ids(page2), ["p2", "p4"]);
    const over = q.images(imgQuery(imgWhere(), list({ sort: "rating", order: "desc", limit: 2, page: 99 })));
    t.eq("超界頁碼夾制到最後一頁", over.page, 2);
    const nolimit = q.images(imgQuery(imgWhere(), list({ limit: 0 })));
    t.eq("limit 0 不分頁", nolimit.items.length, 4);
    t.eq("limit 0 pages 1", nolimit.pages, 1);
  }

  // ── tags 獨立列表：count = 原始總使用數 ──
  {
    const res = q.tags(new TagQuery());
    t.eq("standalone 依 count desc、同分 name asc", res.items.map((tg) => `${tg.name}:${tg.count}`), ["fruit:3", "red:2", "dry:1"]);
    t.eq("standalone total", res.total, 3);
  }

  // ── tags universe=all：併入僅有 metadata、未被使用的標籤（count 0）──
  {
    db.setTagMeta("ghost", { hidden: true }); // 沒有任何圖片使用，但存在 metadata
    const used = q.tags(new TagQuery(new TagWhere({ universe: "used" })));
    t.ok("universe=used 不含未使用的 ghost", used.items.every((tg) => tg.name !== "ghost"));
    const all = q.tags(new TagQuery(new TagWhere({ universe: "all", name: "ghost" })));
    t.eq("universe=all 併入 ghost（count 0）", all.items.map((tg) => `${tg.name}:${tg.count}`), ["ghost:0"]);
    db.deleteTagMeta("ghost"); // 還原 fixture
  }

  // ── tags 排序：name 排序、多個 count-0 併入的名稱序（沿用 p1-p4 fixture：fruit3/red2/dry1）──
  // 同 count 的 name 升冪 tiebreak 由下方 facet 的 fruit:2/red:2 與此處 count-0 尾巴一併涵蓋。
  {
    // sort=name（新路徑：預排名稱 + 反轉，不經 Intl tiebreak）
    t.eq(
      "tags sort=name asc",
      q.tags(new TagQuery(new TagWhere(), new ListOptions({ sort: "name", order: "asc" }))).items.map((tg) => tg.name),
      ["dry", "fruit", "red"],
    );
    t.eq(
      "tags sort=name desc",
      q.tags(new TagQuery(new TagWhere(), new ListOptions({ sort: "name", order: "desc" }))).items.map((tg) => tg.name),
      ["red", "fruit", "dry"],
    );

    // 多個未使用的 count-0 meta 標籤（用非預設 hidden:true 才會持久化），universe=all 應依名稱插入正確位置
    db.setTagMeta("alpha", { hidden: true });
    db.setTagMeta("zebra", { hidden: true });
    db.setTagMeta("mango", { hidden: true });
    t.eq(
      "count-0 未使用標籤依名稱交錯（sort=name asc）",
      q
        .tags(new TagQuery(new TagWhere({ universe: "all" }), new ListOptions({ sort: "name", order: "asc" })))
        .items.map((tg) => tg.name),
      ["alpha", "dry", "fruit", "mango", "red", "zebra"],
    );
    t.eq(
      "count-0 未使用標籤排尾且彼此名稱升冪（sort=count desc）",
      q.tags(new TagQuery(new TagWhere({ universe: "all" }))).items.map((tg) => `${tg.name}:${tg.count}`),
      ["fruit:3", "red:2", "dry:1", "alpha:0", "mango:0", "zebra:0"],
    );
    db.deleteTagMeta("alpha"); // 還原 fixture
    db.deleteTagMeta("zebra");
    db.deleteTagMeta("mango");
  }

  // ── facets：scope 篩選後計數（無 hidden，故 = 交集大小）──
  {
    const scope = imgWhere({ includedTags: ["red"] });
    const res = q.facets(new TagFacetQuery(scope));
    t.eq("facet scope=[red] 計數", res.items.map((tg) => `${tg.name}:${tg.count}`), ["fruit:2", "red:2"]);
    t.ok("facet 過濾掉 count 0 的 dry", res.items.every((tg) => tg.name !== "dry"));
  }

  // ── 單張存取 / 計數 ──
  {
    t.eq("getImage 命中含 id", q.getImage("p1")?.id, "p1");
    t.eq("getImage 缺席回 null", q.getImage("nope"), null);
    t.eq("getAllImages 不篩選全體", q.getAllImages().map((i) => i.id).sort(), ["p1", "p2", "p3", "p4"]);
    t.eq("getImageCount 原始總數", q.getImageCount(), 4);
    t.ok("hasImage 命中", q.hasImage("p2"));
    t.ok("hasImage 缺席", q.hasImage("nope") === false);
  }
}

export default { name, run };
