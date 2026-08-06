/**
 * @file guards.suite.mjs
 * 每支端點開頭的就緒守衛，以及檔名安全檢查。
 *
 * 守衛是各端點各自重複寫的（刻意不抽成共用助手），所以這裡逐支確認，
 * 避免哪一天新增端點忘了寫也沒人發現。
 */

export const name = "api guards（未就緒 503 / 檔名 400）";

export async function run(t, h) {
  const { api, call, freshCollection, detachCollection } = h;

  // ── 未載入圖片集時一律 503，且錯誤 body 恆為 { message } ──
  {
    detachCollection();

    const cases = [
      ["GET /api/files", () => call(api.files.GET)],
      ["POST /api/files", () => call(api.files.POST, { body: {} })],
      ["GET /api/files/[name]", () => call(api.file.GET, { params: { name: "a.png" } })],
      ["DELETE /api/files/[name]", () => call(api.file.DELETE, { params: { name: "a.png" } })],
      ["GET /api/records", () => call(api.records.GET)],
      ["POST /api/records", () => call(api.records.POST, { body: { "a.png": {} } })],
      ["PUT /api/records", () => call(api.records.PUT, { body: { "a.png": {} } })],
      ["PATCH /api/records", () => call(api.records.PATCH, { body: { "a.png": null } })],
      ["GET /api/records/[id]", () => call(api.record.GET, { params: { id: "a.png" } })],
      ["POST /api/records/[id]", () => call(api.record.POST, { params: { id: "a.png" }, body: {} })],
      ["PUT /api/records/[id]", () => call(api.record.PUT, { params: { id: "a.png" }, body: {} })],
      ["PATCH /api/records/[id]", () => call(api.record.PATCH, { params: { id: "a.png" }, body: {} })],
      ["DELETE /api/records/[id]", () => call(api.record.DELETE, { params: { id: "a.png" } })],
      ["GET /api/tags", () => call(api.tags.GET)],
      ["PATCH /api/tags", () => call(api.tags.PATCH, { body: { x: null } })],
      ["POST /api/tags/counts", () => call(api.tagCounts.POST, { body: { names: [] } })],
      ["GET /api/tags/[name]", () => call(api.tag.GET, { params: { name: "x" } })],
      ["PATCH /api/tags/[name]", () => call(api.tag.PATCH, { params: { name: "x" }, body: { hidden: true } })],
      ["DELETE /api/tags/[name]", () => call(api.tag.DELETE, { params: { name: "x" } })],
      ["GET /api/collection/backup", () => call(api.backup.GET)],
      ["GET /api/maintenance/orphans", () => call(api.orphans.GET)],
      ["DELETE /api/maintenance/orphans", () => call(api.orphans.DELETE)],
      ["GET /api/maintenance/metadata", () => call(api.metadata.GET)],
      ["PATCH /api/maintenance/metadata", () => call(api.metadata.PATCH)],
    ];

    for (const [label, run] of cases) {
      const r = await run();
      t.eq(`${label} 未就緒回 503`, { status: r.status, message: r.body?.message }, { status: 503, message: "尚未載入圖片集" });
    }
  }

  // ── /api/collection 與 /api/cache 刻意不設守衛 ──
  {
    detachCollection();

    const r = await call(api.collection.GET);
    t.eq("GET /api/collection 未就緒仍可用", r.status, 200);
    t.eq("未就緒時 loaded 為 false", r.body.loaded, false);

    const stats = await call(api.cache.GET);
    t.eq("GET /api/cache 未就緒仍可用", stats.status, 200);
  }

  // ── 檔名安全：路徑穿越 / 空字串一律 400 ──
  {
    freshCollection();

    const bad = ["../etc/passwd", "a/b.png", ".hidden", ""];

    for (const name of bad) {
      const r = await call(api.file.GET, { params: { name } });
      t.eq(`GET /api/files/[name] 拒絕 ${JSON.stringify(name)}`, r.status, 400);

      const d = await call(api.file.DELETE, { params: { name } });
      t.eq(`DELETE /api/files/[name] 拒絕 ${JSON.stringify(name)}`, d.status, 400);

      const g = await call(api.record.GET, { params: { id: name } });
      t.eq(`GET /api/records/[id] 拒絕 ${JSON.stringify(name)}`, g.status, 400);
    }
  }

  // ── 批次端點：非物件 body 與空物件 ──
  {
    freshCollection();

    const notObject = await call(api.records.POST, { body: [1, 2] });
    t.eq("POST /api/records 拒絕非物件 body", notObject.status, 400);

    const empty = await call(api.records.PATCH, { body: {} });
    t.eq("PATCH /api/records 拒絕空物件", empty.status, 400);

    const emptyTags = await call(api.tags.PATCH, { body: {} });
    t.eq("PATCH /api/tags 拒絕空物件", emptyTags.status, 400);

    const badJson = await call(api.records.POST, { body: "{ 壞掉的 json" });
    t.eq("POST /api/records 拒絕無法解析的 JSON", badJson.status, 400);
  }
}

export default { name, run };
