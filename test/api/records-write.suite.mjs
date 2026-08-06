/**
 * @file records-write.suite.mjs
 * 成員層的 POST / PUT / PATCH / DELETE：語意差異、樂觀併發，以及錯誤是否收斂成單一形狀。
 */

export const name = "api records 寫入（成員層四個動詞）";

export async function run(t, h) {
  const { api, call, freshCollection, putImage, putText, seedRecord, modules } = h;

  // ── POST：建立，且必須真的讀了檔案元資料 ──
  {
    freshCollection();
    await putImage("a.png", { width: 40, height: 20 });

    const r = await call(api.record.POST, { params: { id: "a.png" }, body: { name: "阿爾法", tags: ["風景"], rating: 4 } });
    t.eq("POST 建立成功", r.status, 200);
    t.eq("回傳的是建立後的紀錄", { id: r.body.id, name: r.body.name, rating: r.body.rating }, { id: "a.png", name: "阿爾法", rating: 4 });
    t.eq("寬高來自實際檔案而非請求", { w: r.body.width, h: r.body.height }, { w: 40, h: 20 });
    t.ok("blurhash 已算出", typeof r.body.blurhash === "string" && r.body.blurhash.length > 0);

    const again = await call(api.record.POST, { params: { id: "a.png" }, body: { name: "重複", tags: ["x"] } });
    t.eq("重複 POST 回 409", again.status, 409);
    t.eq("409 訊息已本地化", again.body.message, "目標已存在，請重新整理後再試");
  }

  // ── POST：檔案側前置檢查 ──
  {
    freshCollection();

    const missing = await call(api.record.POST, { params: { id: "nope.png" }, body: { name: "x", tags: ["y"] } });
    t.eq("檔案不存在回 404", missing.status, 404);

    putText("note.txt");
    const notImage = await call(api.record.POST, { params: { id: "note.txt" }, body: { name: "x", tags: ["y"] } });
    t.eq("非圖片副檔名回 400", notImage.status, 400);
  }

  // ── POST：欄位驗證由 mutation 負責，端點不預判也不補值 ──
  {
    freshCollection();
    await putImage("a.png");

    const noTags = await call(api.record.POST, { params: { id: "a.png" }, body: { name: "阿爾法", tags: [] } });
    t.eq("標籤為空由 mutation 擋下（400）", noTags.status, 400);
    t.ok("訊息帶出欄位名", noTags.body.message.includes("tags"));

    const badRating = await call(api.record.POST, { params: { id: "a.png" }, body: { name: "阿爾法", tags: ["x"], rating: 9 } });
    t.eq("評分超界回 400", badRating.status, 400);
  }

  // ── PUT：與 POST 的差別只在已存在時覆寫 ──
  {
    freshCollection();
    await putImage("a.png");

    const created = await call(api.record.PUT, { params: { id: "a.png" }, body: { name: "第一版", tags: ["x"] } });
    t.eq("PUT 可建立", created.status, 200);

    const replaced = await call(api.record.PUT, { params: { id: "a.png" }, body: { name: "第二版", tags: ["y"] } });
    t.eq("PUT 覆寫既有紀錄", replaced.status, 200);
    t.eq("內容已被換掉", { name: replaced.body.name, tags: replaced.body.tags }, { name: "第二版", tags: ["y"] });
  }

  // ── PATCH：樂觀併發 ──
  {
    freshCollection();
    const seeded = seedRecord("a.png", { name: "原名", updatedAt: 1000, tags: ["舊"] });

    const stale = await call(api.record.PATCH, { params: { id: "a.png" }, body: { name: "新名", expectedUpdatedAt: 999 } });
    t.eq("expectedUpdatedAt 不符回 409", stale.status, 409);
    t.eq("409 訊息已本地化", stale.body.message, "紀錄已被其他操作更新，請重新整理後再試");

    const okPatch = await call(api.record.PATCH, {
      params: { id: "a.png" },
      body: { name: "新名", tags: ["新"], expectedUpdatedAt: seeded.updatedAt },
    });
    t.eq("expectedUpdatedAt 相符即更新", okPatch.status, 200);
    t.eq("內容已更新", { name: okPatch.body.name, tags: okPatch.body.tags }, { name: "新名", tags: ["新"] });
    t.ok("updatedAt 被推進", okPatch.body.updatedAt > 1000);

    const missing = await call(api.record.PATCH, { params: { id: "nope.png" }, body: { expectedUpdatedAt: 1 } });
    t.eq("目標不存在回 404", missing.status, 404);
  }

  // ── DELETE：只移除紀錄，實體檔案留著 ──
  {
    freshCollection();
    await putImage("a.png");
    await call(api.record.POST, { params: { id: "a.png" }, body: { name: "阿爾法", tags: ["x"] } });

    const removed = await call(api.record.DELETE, { params: { id: "a.png" } });
    t.eq("DELETE 回 200", removed.status, 200);
    t.eq("回傳被退回的 id", removed.body, { id: "a.png" });

    const query = new modules.Query(modules.Database.requireLoaded());
    t.eq("紀錄已消失", query.hasImage("a.png"), false);
    t.eq("實體檔案仍在", modules.ImageLibrary.has("a.png"), true);

    const again = await call(api.record.DELETE, { params: { id: "a.png" } });
    t.eq("重複 DELETE 回 404", again.status, 404);
  }
}

export default { name, run };
