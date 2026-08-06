/**
 * @file tag-changes.suite.mjs
 * `Mutation.applyTagChanges`：以標籤名為鍵的批次異動。
 *
 * 這裡驗證的是**業務規則**本身（執行順序、集合層衝突、逐筆獨立失敗），
 * HTTP 那一層怎麼把它轉成回應則由 test/api/tags.suite.mjs 負責。
 */

export const name = "mutation applyTagChanges（順序 / 集合層衝突）";

export async function run(t, h) {
  const { Mutation } = h.modules;

  const seed = () => {
    const db = h.freshDb();
    return { db, mutation: new Mutation(db) };
  };

  // 標籤在紀錄裡的順序由 sortCollator 決定，這裡要驗的是「有哪些標籤」，不是排序本身
  const tagsOf = (db, id) => db.getImage(id)?.tags?.toSorted() ?? null;

  // ── 三種操作的基本語意 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["舊名", "垃圾"] });
    h.putImage(db, "b.png", { tags: ["劇透", "其他"] });

    const r = mutation.applyTagChanges({
      舊名: { name: "新名" },
      垃圾: null,
      劇透: { hidden: true },
    });

    t.eq("結果的鍵 = 請求的鍵", Object.keys(r).toSorted(), ["劇透", "垃圾", "舊名"].toSorted());
    t.eq("三筆都成功", Object.values(r).every((x) => x.ok), true);
    t.eq("改名生效、刪除生效", tagsOf(db, "a.png"), ["新名"]);
    t.eq("顯隱生效", db.getTagMeta("劇透").hidden, true);
    t.eq("受影響筆數", r["舊名"].data.affected, 1);
    t.eq("純顯隱的 affected 為 0", r["劇透"].data.affected, 0);
  }

  // ── 順序：刪除先於改名，因此刪除看到的是原名 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["A", "保留"] });
    h.putImage(db, "b.png", { tags: ["B", "保留"] });

    // A→C 與刪除 B，兩者互不相干，順序不影響結果，但都必須成立
    const r = mutation.applyTagChanges({ A: { name: "C" }, B: null });
    t.eq("互不相干的兩筆都成功", [r["A"].ok, r["B"].ok], [true, true]);
    t.eq("A 已改名", tagsOf(db, "a.png"), ["C", "保留"].toSorted());
    t.eq("B 已刪除", tagsOf(db, "b.png"), ["保留"]);
  }

  // ── 集合層規則：改名目標同時被刪除 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["來源", "保留"] });
    h.putImage(db, "b.png", { tags: ["目標", "保留"] });

    const r = mutation.applyTagChanges({ 來源: { name: "目標" }, 目標: null });

    t.eq("刪除照樣執行", r["目標"].ok, true);
    t.eq("指向被刪目標的改名被擋下", r["來源"].ok, false);
    t.eq("擋下的原因是驗證失敗", r["來源"].error.kind, "validation");
    t.ok("訊息說明是哪個目標", r["來源"].error.message.includes("目標"));
    t.eq("來源標籤原封不動", tagsOf(db, "a.png"), ["保留", "來源"].toSorted());
  }

  // ── 集合層規則：改名目標本身也要改名 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["A"] });
    h.putImage(db, "b.png", { tags: ["B"] });

    const r = mutation.applyTagChanges({ A: { name: "B" }, B: { name: "C" } });

    t.eq("A→B 被擋下", r["A"].ok, false);
    t.eq("B→C 照常執行", r["B"].ok, true);
    t.eq("A 原封不動", tagsOf(db, "a.png"), ["A"]);
    t.eq("B 已變成 C", tagsOf(db, "b.png"), ["C"]);
  }

  // ── 集合層規則：改名成自己不算衝突 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["A"] });

    const r = mutation.applyTagChanges({ A: { name: "A" } });
    t.eq("改名成自己是無操作的成功", r["A"].ok, true);
    t.eq("affected 為 0", r["A"].data.affected, 0);
  }

  // ── 集合層規則：目標只是被設定顯隱，不算衝突 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["來源"] });
    h.putImage(db, "b.png", { tags: ["目標"] });

    const r = mutation.applyTagChanges({ 來源: { name: "目標" }, 目標: { hidden: true } });
    t.eq("合併成功", r["來源"].ok, true);
    t.eq("顯隱也成功", r["目標"].ok, true);
    t.eq("合併後的標籤", tagsOf(db, "a.png"), ["目標"]);
    t.eq("顯隱設在目標上", db.getTagMeta("目標").hidden, true);
  }

  // ── 改名同時帶顯隱：顯隱套在改名後的名稱上 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["舊名"] });

    const r = mutation.applyTagChanges({ 舊名: { name: "新名", hidden: true } });
    t.eq("成功", r["舊名"].ok, true);
    t.eq("顯隱設在新名上", db.getTagMeta("新名").hidden, true);
    t.eq("舊名沒有殘留元資料", db.tagMetaEntries().map(([n]) => n), ["新名"]);
  }

  // ── 逐筆獨立：一筆失敗不影響其他筆 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["唯一"] });
    h.putImage(db, "b.png", { tags: ["可刪", "保留"] });

    const r = mutation.applyTagChanges({ 唯一: null, 可刪: null, 不存在: null });

    t.eq("會讓圖片失去最後一個標籤 → last_tag", r["唯一"].error.kind, "last_tag");
    t.eq("last_tag 帶受影響的 id", r["唯一"].error.images, ["a.png"]);
    t.eq("不存在的標籤 → not_found", r["不存在"].error.kind, "not_found");
    t.eq("合法的那筆照樣執行", r["可刪"].ok, true);
    t.eq("失敗的那張圖沒被動到", tagsOf(db, "a.png"), ["唯一"]);
    t.eq("成功的那張圖已更新", tagsOf(db, "b.png"), ["保留"]);
  }

  // ── 值本身的格式驗證 ──
  {
    const { db, mutation } = seed();
    h.putImage(db, "a.png", { tags: ["A"] });

    const r = mutation.applyTagChanges({
      格式壞掉: 123,
      沒說要幹嘛: {},
      顯隱不是布林: { hidden: "true" },
      名稱不合法: { name: "  " },
    });

    for (const key of Object.keys(r)) {
      t.eq(`${key} → validation`, r[key].error.kind, "validation");
    }
    t.eq("名稱不合法的欄位指到 name", r["名稱不合法"].error.fields, ["name"]);
    t.eq("顯隱不合法的欄位指到 hidden", r["顯隱不是布林"].error.fields, ["hidden"]);
  }
}

export default { name, run };
