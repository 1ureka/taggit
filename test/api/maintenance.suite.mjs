/**
 * @file maintenance.suite.mjs
 * `/api/maintenance/*`：兩種整合性問題各是一個資源，GET 檢查、寫入動詞修復。
 */

export const name = "api maintenance（孤兒紀錄 / 缺元資料）";

export async function run(t, h) {
  const { api, call, freshCollection, putImage, removeFile, seedRecord, modules } = h;

  // ── orphans：有紀錄、檔案卻不存在 ──
  {
    freshCollection();
    await putImage("a.png");
    await putImage("b.png");
    seedRecord("a.png");
    seedRecord("b.png");
    seedRecord("ghost.png"); // 從來就沒有檔案
    removeFile("b.png"); // 檔案被外部刪掉

    const listed = await call(api.orphans.GET);
    t.eq("回 200", listed.status, 200);
    t.eq("列出兩筆孤兒", listed.body.items.toSorted(), ["b.png", "ghost.png"]);
    t.eq("total 與 items 一致", listed.body.total, 2);

    const removed = await call(api.orphans.DELETE);
    t.eq("回傳被移除的 id", removed.body.removed.toSorted(), ["b.png", "ghost.png"]);

    const query = new modules.Query(modules.Database.requireLoaded());
    t.eq("孤兒紀錄已清掉", [query.hasImage("b.png"), query.hasImage("ghost.png")], [false, false]);
    t.eq("檔案還在的那筆不受影響", query.hasImage("a.png"), true);

    const after = await call(api.orphans.GET);
    t.eq("再檢查一次已經乾淨", after.body, { items: [], total: 0 });
  }

  // ── metadata：缺 blurhash 或寬高 ──
  {
    freshCollection();
    await putImage("a.png", { width: 48, height: 24 });
    await putImage("b.png", { width: 30, height: 30 });
    seedRecord("a.png", { blurhash: "", width: 0, height: 0 });
    seedRecord("b.png", { blurhash: "已有", width: 30, height: 30 });

    const listed = await call(api.metadata.GET);
    t.eq("只列出缺元資料的那筆", listed.body.items, ["a.png"]);
    t.eq("total 與 items 一致", listed.body.total, 1);

    const repaired = await call(api.metadata.PATCH);
    t.eq("回傳被補齊的 id", repaired.body, { repaired: ["a.png"] });

    const query = new modules.Query(modules.Database.requireLoaded());
    const fixed = query.getImage("a.png");
    t.eq("寬高已從實際檔案補上", { w: fixed.width, h: fixed.height }, { w: 48, h: 24 });
    t.ok("blurhash 已補上", fixed.blurhash.length > 0);

    const after = await call(api.metadata.GET);
    t.eq("再檢查一次已經乾淨", after.body, { items: [], total: 0 });
  }

  // ── metadata：檔案不見的紀錄補不了，但不會讓整支端點失敗 ──
  {
    freshCollection();
    seedRecord("ghost.png", { blurhash: "", width: 0, height: 0 });
    await putImage("a.png", { width: 20, height: 10 });
    seedRecord("a.png", { blurhash: "", width: 0, height: 0 });

    const repaired = await call(api.metadata.PATCH);
    t.eq("只補得到有檔案的那筆", repaired.body, { repaired: ["a.png"] });
    t.eq("補不了的仍留在待修清單", (await call(api.metadata.GET)).body.items, ["ghost.png"]);
  }
}

export default { name, run };
