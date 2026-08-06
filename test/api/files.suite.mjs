/**
 * @file files.suite.mjs
 * `/api/files`：實體檔案這一側。列表分群、二進位表示、上傳，以及「已提交就不准直接刪檔」。
 */

import fs from "node:fs";
import path from "node:path";

export const name = "api files（列表 / 二進位 / 上傳 / 刪除）";

export async function run(t, h) {
  const { api, call, freshCollection, putImage, putText, seedRecord, modules, imagesDir } = h;

  // ── 列表與 state 分群 ──
  {
    freshCollection();
    await putImage("a.png");
    await putImage("b.png");
    putText("note.txt");
    seedRecord("a.png");

    const all = await call(api.files.GET);
    t.eq("回 200", all.status, 200);
    t.eq("只列支援的圖片副檔名", all.body.items.map((f) => f.name), ["a.png", "b.png"]);
    t.eq("標記哪些已有紀錄", Object.fromEntries(all.body.items.map((f) => [f.name, f.committed])), { "a.png": true, "b.png": false });

    const staged = await call(api.files.GET, { url: "?state=staged" });
    t.eq("state=staged 只列沒有紀錄的", staged.body.items.map((f) => f.name), ["b.png"]);

    const committed = await call(api.files.GET, { url: "?state=committed" });
    t.eq("state=committed 只列有紀錄的", committed.body.items.map((f) => f.name), ["a.png"]);
    t.eq("total 跟著篩選走", committed.body.total, 1);

    const bad = await call(api.files.GET, { url: "?state=nope" });
    t.eq("無效的 state 回 400", bad.status, 400);
  }

  // ── 二進位：資源表示就是圖片本身 ──
  {
    freshCollection();
    await putImage("a.png", { width: 64, height: 64 });

    const original = await call(api.file.GET, { params: { name: "a.png" } });
    t.eq("預設 xl 回原圖 MIME", original.res.headers.get("content-type"), "image/png");
    t.ok("帶 Cache-Control", (original.res.headers.get("cache-control") ?? "").includes("max-age"));

    const thumb = await call(api.file.GET, { params: { name: "a.png" }, url: "?size=md" });
    t.eq("縮圖轉成 webp", thumb.res.headers.get("content-type"), "image/webp");

    const badSize = await call(api.file.GET, { params: { name: "a.png" }, url: "?size=huge" });
    t.eq("無效尺寸回 400", badSize.status, 400);

    const missing = await call(api.file.GET, { params: { name: "nope.png" } });
    t.eq("檔案不存在回 404", missing.status, 404);
    t.eq("404 body 是 { message }", missing.body, { message: "找不到檔案" });
  }

  // ── 刪除：已提交的檔案必須先退回 ──
  {
    freshCollection();
    await putImage("a.png");
    await putImage("b.png");
    seedRecord("a.png");

    const blocked = await call(api.file.DELETE, { params: { name: "a.png" } });
    t.eq("已有紀錄的檔案回 409", blocked.status, 409);
    t.eq("409 訊息說明該怎麼做", blocked.body, { message: "請先退回提交，再刪除檔案" });
    t.eq("檔案沒被動到", modules.ImageLibrary.has("a.png"), true);

    const removed = await call(api.file.DELETE, { params: { name: "b.png" } });
    t.eq("沒有紀錄的檔案可刪", removed.status, 200);
    t.eq("回傳被刪除的檔名", removed.body, { name: "b.png" });
    t.eq("實體檔案真的不見了", modules.ImageLibrary.has("b.png"), false);

    const again = await call(api.file.DELETE, { params: { name: "b.png" } });
    t.eq("重複刪除回 404", again.status, 404);
  }

  // ── 上傳：唯一以陣列回報逐筆結果的端點 ──
  {
    freshCollection();

    const form = new FormData();
    form.append("files", new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" }));
    form.append("files", new File([new Uint8Array([4, 5])], "note.txt", { type: "text/plain" }));

    const r = await call(api.files.POST, { form });
    t.eq("回 200", r.status, 200);
    t.eq("結果數量與順序對齊上傳", r.body.results.length, 2);
    t.eq("圖片檔成功並回伺服器決定的 id", { ok: r.body.results[0].ok, id: r.body.results[0].id }, { ok: true, id: "photo.png" });
    t.eq("非圖片檔失敗並帶原因", r.body.results[1], { ok: false, name: "note.txt", message: "不支援的檔案格式" });
    t.ok("檔案真的落地了", fs.existsSync(path.join(imagesDir(), "photo.png")));
  }

  // ── 上傳：同名檔案自動改名，不覆寫既有的 ──
  {
    freshCollection();
    await putImage("photo.png");

    const form = new FormData();
    form.append("files", new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" }));

    const r = await call(api.files.POST, { form });
    t.eq("回傳的 id 是改名後的", r.body.results[0].id, "photo_1.png");
    t.ok("原本的檔案還在", fs.existsSync(path.join(imagesDir(), "photo.png")));
  }

  // ── 上傳：請求本身不合法 ──
  {
    freshCollection();

    const notMultipart = await call(api.files.POST, { body: { files: [] } });
    t.eq("非 multipart 回 400", notMultipart.status, 400);

    const noFiles = await call(api.files.POST, { form: new FormData() });
    t.eq("沒有任何檔案回 400", noFiles.status, 400);
  }
}

export default { name, run };
