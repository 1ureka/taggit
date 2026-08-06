/**
 * @file collection.suite.mjs
 * `/api/collection` 與 `/api/cache`：兩支刻意不設就緒守衛的資源。
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const name = "api collection / cache";

export async function run(t, h) {
  const { api, call, freshCollection, detachCollection, putImage, modules } = h;

  // ── GET：不需要就緒，且不得有副作用 ──
  {
    detachCollection();

    const probe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "taggit-api-")), "collection");
    fs.mkdirSync(probe, { recursive: true });

    const before = await call(api.collection.GET);
    t.eq("回 200", before.status, 200);
    t.eq("只有三個欄位", Object.keys(before.body).toSorted(), ["loaded", "name", "root"]);
    t.eq("未就緒時 loaded=false", before.body.loaded, false);
    t.ok("GET 不會順手建立 images/ 子目錄", !fs.existsSync(path.join(probe, "images")));
  }

  // ── PUT：設定路徑並就緒 ──
  {
    detachCollection();

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "taggit-api-put-"));

    const r = await call(api.collection.PUT, { body: { root } });
    t.eq("回 200", r.status, 200);
    t.eq("回傳設定後的表示", { root: r.body.root, loaded: r.body.loaded }, { root, loaded: true });
    t.eq("name 由路徑推導", r.body.name, path.basename(root));
    t.ok("PUT 會建立 images/ 子目錄", fs.existsSync(path.join(root, "images")));
    t.eq("資料庫已載入", modules.Database.isLoaded(), true);
    t.eq("圖片庫已綁定", modules.ImageLibrary.isActive(), true);

    fs.rmSync(root, { recursive: true, force: true });
  }

  // ── PUT：無效輸入 ──
  {
    detachCollection();

    const empty = await call(api.collection.PUT, { body: { root: "   " } });
    t.eq("空白路徑回 400", empty.status, 400);
    t.eq("400 body 是 { message }", empty.body, { message: "無效的圖片集路徑" });

    const wrongType = await call(api.collection.PUT, { body: { root: 123 } });
    t.eq("非字串回 400", wrongType.status, 400);

    const nonexistent = await call(api.collection.PUT, { body: { root: path.join(os.tmpdir(), "taggit-絕不存在-xyz") } });
    t.eq("路徑不存在回 422", nonexistent.status, 422);
    t.eq("422 訊息說明原因", nonexistent.body, { message: "路徑不存在或無法建立所需的子目錄" });
  }

  // ── /api/cache ──
  {
    freshCollection();
    await putImage("a.png");

    const cleared = await call(api.cache.DELETE);
    t.eq("先清空", cleared.status, 200);

    const emptyStats = await call(api.cache.GET);
    t.eq("清空後沒有任何項目", emptyStats.body.entries, 0);

    // 產生一張縮圖讓快取有東西
    await call(api.file.GET, { params: { name: "a.png" }, url: "?size=sm" });

    const stats = await call(api.cache.GET);
    t.eq("統計只有 entries 與 bytes", Object.keys(stats.body).toSorted(), ["bytes", "entries"]);
    t.eq("縮圖後有一筆快取", stats.body.entries, 1);
    t.ok("已使用位元組數大於 0", stats.body.bytes > 0);

    const r = await call(api.cache.DELETE);
    t.eq("清空回被清掉的筆數", r.body, { cleared: 1 });
    t.eq("清空後歸零", (await call(api.cache.GET)).body.entries, 0);
  }
}

export default { name, run };
