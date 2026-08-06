/**
 * @file tags.suite.mjs
 * `/api/tags`：分面查詢，以及以標籤名為鍵的批次異動（含執行順序與集合層衝突）。
 */

export const name = "api tags（GET 分面 / PATCH 批次 / 成員層）";

export async function run(t, h) {
  const { api, call, freshCollection, seedRecord, seedTagMeta, modules } = h;

  // 標籤在紀錄裡的順序由 sortCollator 決定，這裡要驗的是「有哪些標籤」，不是排序本身
  const tagsOf = (id) => new modules.Query(modules.Database.requireLoaded()).getImage(id)?.tags?.toSorted() ?? null;

  /** 把分面結果攤成與順序無關的 `名稱=計數` 清單 */
  const countsOf = (body) => body.items.map((x) => `${x.name}=${x.count}`).toSorted();

  // ── GET：分面計數與 scope ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["風景", "夜景"], rating: 5 });
    seedRecord("b.png", { tags: ["風景"], rating: 1 });
    seedRecord("c.png", { tags: ["人像"], rating: 3 });

    const all = await call(api.tags.GET);
    t.eq("回 200", all.status, 200);
    t.eq("body 頂層就是 Paginated", Object.keys(all.body).toSorted(), ["items", "page", "pages", "total"]);
    t.eq("全集分面計數", countsOf(all.body), ["人像=1", "夜景=1", "風景=2"].toSorted());

    const scoped = await call(api.tags.GET, { url: "?includedTags=夜景" });
    t.eq("帶 ImageWhere 作為 scope 後計數縮小", countsOf(scoped.body), ["夜景=1", "風景=1"].toSorted());

    const named = await call(api.tags.GET, { url: "?name=景" });
    t.eq("TagWhere.name 子字串篩選", named.body.items.map((x) => x.name).toSorted(), ["夜景", "風景"]);

    const sorted = await call(api.tags.GET, { url: "?sort=count&order=desc&limit=1" });
    t.eq("排序與分頁", sorted.body.items.map((x) => x.name), ["風景"]);
  }

  // ── GET：hidden 遮蔽 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["風景", "劇透"] });
    seedRecord("b.png", { tags: ["風景"] });
    seedTagMeta("劇透", { hidden: true });

    const r = await call(api.tags.GET);
    t.eq("hidden 遮蔽後的分面計數", countsOf(r.body), ["劇透=1", "風景=1"].toSorted());
  }

  // ── PATCH：三種操作混在同一次請求 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["舊名", "垃圾"] });
    seedRecord("b.png", { tags: ["劇透", "風景"] });

    const r = await call(api.tags.PATCH, {
      body: {
        舊名: { name: "新名" },
        垃圾: null,
        劇透: { hidden: true },
      },
    });

    t.eq("回 200", r.status, 200);
    t.eq("回應的鍵 = 請求的鍵（不是改名後的名字）", Object.keys(r.body).toSorted(), ["劇透", "垃圾", "舊名"].toSorted());
    t.eq("三筆都成功", Object.values(r.body).every((x) => x.ok), true);
    t.eq("改名生效", tagsOf("a.png"), ["新名"]);
    t.eq("顯隱生效", modules.Database.requireLoaded().getTagMeta("劇透").hidden, true);
  }

  // ── PATCH：執行順序是 刪除 → 改名 → 顯隱 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["來源", "其他"] });
    seedRecord("b.png", { tags: ["目標", "其他"] });

    // 目標先被刪除、來源又要改名成目標 —— 意圖無法判定，該筆必須失敗
    const conflict = await call(api.tags.PATCH, { body: { 來源: { name: "目標" }, 目標: null } });
    t.eq("刪除照樣執行", conflict.body["目標"].ok, true);
    t.eq("指向被刪目標的改名被擋下", conflict.body["來源"].ok, false);
    t.ok("失敗訊息說明原因", conflict.body["來源"].message.includes("也被刪除"));
    t.eq("來源標籤原封不動", tagsOf("a.png"), ["其他", "來源"].toSorted());
  }

  // ── PATCH：改名目標本身也被改名時同樣擋下 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["A"] });
    seedRecord("b.png", { tags: ["B"] });

    const r = await call(api.tags.PATCH, { body: { A: { name: "B" }, B: { name: "C" } } });
    t.eq("A→B 被擋下", r.body["A"].ok, false);
    t.ok("失敗訊息說明原因", r.body["A"].message.includes("也被改名"));
    t.eq("B→C 照常執行", r.body["B"].ok, true);
    t.eq("B 已變成 C", tagsOf("b.png"), ["C"]);
  }

  // ── PATCH：合併（改名成既有標籤）──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["貓咪"] });
    seedRecord("b.png", { tags: ["貓"] });
    seedRecord("c.png", { tags: ["貓", "貓咪"] });

    const r = await call(api.tags.PATCH, { body: { 貓咪: { name: "貓" } } });
    t.eq("合併成功", r.body["貓咪"], { ok: true });
    t.eq("原本只有貓咪的改成貓", tagsOf("a.png"), ["貓"]);
    t.eq("兩個都有的去重", tagsOf("c.png"), ["貓"]);
  }

  // ── PATCH：逐筆錯誤收斂成人類可讀訊息 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["唯一"] });

    const r = await call(api.tags.PATCH, { body: { 唯一: null, 不存在: null, 格式壞掉: 123 } });
    t.eq("刪除會讓圖片失去最後一個標籤 → 失敗", r.body["唯一"], { ok: false, message: "有 1 張圖片會因此失去最後一個標籤" });
    t.eq("刪除不存在的標籤 → 404 語意", r.body["不存在"], { ok: false, message: "找不到目標紀錄" });
    t.eq("值格式無效 → 驗證失敗", r.body["格式壞掉"], { ok: false, message: "異動格式無效（欄位：change）" });
  }

  // ── 成員層 ──
  {
    freshCollection();
    seedRecord("a.png", { tags: ["風景", "備用"] });

    const got = await call(api.tag.GET, { params: { name: "風景" } });
    t.eq("GET 單一標籤", { name: got.body.name, count: got.body.count }, { name: "風景", count: 1 });

    const missing = await call(api.tag.GET, { params: { name: "不存在" } });
    t.eq("找不到回 404", missing.status, 404);

    const renamed = await call(api.tag.PATCH, { params: { name: "風景" }, body: { name: "景色" } });
    t.eq("PATCH 改名回改名後的表示", renamed.body.name, "景色");

    const hidden = await call(api.tag.PATCH, { params: { name: "景色" }, body: { hidden: true } });
    t.eq("PATCH 設定顯隱", hidden.body.meta.hidden, true);

    const noop = await call(api.tag.PATCH, { params: { name: "景色" }, body: {} });
    t.eq("PATCH 沒指定任何異動回 400", noop.status, 400);

    const deleted = await call(api.tag.DELETE, { params: { name: "景色" } });
    t.eq("DELETE 回受影響筆數", deleted.body, { name: "景色", affected: 1 });
    t.eq("標籤已從圖片移除", tagsOf("a.png"), ["備用"]);
  }
}

export default { name, run };
