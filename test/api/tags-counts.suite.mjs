/**
 * @file tags-counts.suite.mjs
 * `POST /api/tags/counts`：一組標籤名進去，只有數字出來。
 * 個別計數給標籤影響評估用、聯集張數給合併預估用，輸入相同所以合成同一個資源。
 */

export const name = "api tags/counts（個別計數 + 聯集張數）";

export async function run(t, h) {
  const { api, call, freshCollection, seedRecord, seedTagMeta } = h;

  {
    freshCollection();
    seedRecord("a.png", { tags: ["風景", "夜景"] });
    seedRecord("b.png", { tags: ["風景"] });
    seedRecord("c.png", { tags: ["人像"] });

    const r = await call(api.tagCounts.POST, { body: { names: ["風景", "夜景", "廢墟"] } });

    t.eq("回 200", r.status, 200);
    t.eq("只有兩個欄位", Object.keys(r.body).toSorted(), ["counts", "union"]);
    t.eq("個別計數以標籤名為鍵", r.body.counts, { 風景: 2, 夜景: 1, 廢墟: 0 });
    t.eq("聯集張數（a 同時有兩個標籤只算一次）", r.body.union, 2);
  }

  // ── 計數是全域原始使用數：不受 hidden 遮蔽影響 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["風景", "劇透"] });
    seedRecord("b.png", { tags: ["風景"] });
    seedTagMeta("劇透", { hidden: true });

    const r = await call(api.tagCounts.POST, { body: { names: ["風景", "劇透"] } });
    t.eq("hidden 不影響全域計數", r.body.counts, { 風景: 2, 劇透: 1 });
    t.eq("hidden 不影響聯集", r.body.union, 2);
  }

  // ── 邊界 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["x"] });

    const empty = await call(api.tagCounts.POST, { body: { names: [] } });
    t.eq("空陣列不是錯誤", empty.status, 200);
    t.eq("空陣列回空計數", empty.body, { counts: {}, union: 0 });

    const dup = await call(api.tagCounts.POST, { body: { names: ["x", "x", " x "] } });
    t.eq("重複與前後空白會正規化成同一個鍵", dup.body.counts, { x: 1 });

    const junk = await call(api.tagCounts.POST, { body: { names: ["x", 5, null, ""] } });
    t.eq("非字串與空字串被略過", junk.body.counts, { x: 1 });

    const notArray = await call(api.tagCounts.POST, { body: { names: "x" } });
    t.eq("names 不是陣列回 400", notArray.status, 400);
    t.eq("400 body 是 { message }", notArray.body, { message: "names 必須是陣列" });
  }
}

export default { name, run };
