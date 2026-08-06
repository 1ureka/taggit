/**
 * @file records-read.suite.mjs
 * `GET /api/records` 與 `GET /api/records/[id]`：查詢參數是否確實接到 ImageQuery，
 * 以及回應是不是「資源本身」（沒有任何封包）。
 */

export const name = "api records 讀取（GET 集合 / 成員）";

export async function run(t, h) {
  const { api, call, freshCollection, seedRecord } = h;

  // ── 集合：回應直接是 Paginated，沒有 { ok, data } 封包 ──
  {
    freshCollection();
    seedRecord("a.png", { name: "阿爾法", rating: 5, tags: ["風景"] });
    seedRecord("b.png", { name: "貝塔", rating: 3, tags: ["人像"] });
    seedRecord("c.png", { name: "伽瑪", rating: 1, tags: ["風景", "夜景"] });

    const r = await call(api.records.GET);
    t.eq("回 200", r.status, 200);
    t.eq("body 頂層就是 Paginated 欄位", Object.keys(r.body).toSorted(), ["items", "page", "pages", "total"]);
    t.eq("沒有 ok 欄位（封包已拿掉）", "ok" in r.body, false);
    t.eq("total 為 3", r.body.total, 3);
  }

  // ── 集合：ImageWhere 的篩選參數 ──
  {
    freshCollection();
    seedRecord("a.png", { name: "阿爾法", rating: 5, tags: ["風景"] });
    seedRecord("b.png", { name: "貝塔", rating: 3, tags: ["人像"] });
    seedRecord("c.png", { name: "伽瑪", rating: 1, tags: ["風景", "夜景"] });

    const byTag = await call(api.records.GET, { url: "?includedTags=風景" });
    t.eq("includedTags 篩選", byTag.body.items.map((i) => i.id).toSorted(), ["a.png", "c.png"]);

    const excluded = await call(api.records.GET, { url: "?includedTags=風景&excludedTags=夜景" });
    t.eq("excludedTags 篩選", excluded.body.items.map((i) => i.id), ["a.png"]);

    const byRating = await call(api.records.GET, { url: "?rating=3&ratingOp=gte" });
    t.eq("rating 門檻篩選", byRating.body.total, 2);

    const bySearch = await call(api.records.GET, { url: "?search=貝" });
    t.eq("search 名稱子字串篩選", bySearch.body.items.map((i) => i.id), ["b.png"]);
  }

  // ── 集合：排序與分頁 ──
  {
    freshCollection();
    seedRecord("a.png", { name: "阿爾法", rating: 5 });
    seedRecord("b.png", { name: "貝塔", rating: 3 });
    seedRecord("c.png", { name: "伽瑪", rating: 1 });

    const asc = await call(api.records.GET, { url: "?sort=rating&order=asc" });
    t.eq("sort=rating&order=asc", asc.body.items.map((i) => i.id), ["c.png", "b.png", "a.png"]);

    const paged = await call(api.records.GET, { url: "?sort=rating&order=desc&limit=2&page=2" });
    t.eq("limit + page 分頁", paged.body.items.map((i) => i.id), ["c.png"]);
    t.eq("分頁仍回全量 total", paged.body.total, 3);
    t.eq("分頁回總頁數", paged.body.pages, 2);
  }

  // ── 成員 ──
  {
    freshCollection();
    seedRecord("a.png", { name: "阿爾法", rating: 5, tags: ["風景"] });

    const found = await call(api.record.GET, { params: { id: "a.png" } });
    t.eq("GET 成員回 200", found.status, 200);
    t.eq("body 就是那筆紀錄", { id: found.body.id, name: found.body.name, rating: found.body.rating }, { id: "a.png", name: "阿爾法", rating: 5 });

    const missing = await call(api.record.GET, { params: { id: "nope.png" } });
    t.eq("找不到回 404", missing.status, 404);
    t.eq("404 body 是 { message }", missing.body, { message: "找不到目標紀錄" });
  }
}

export default { name, run };
