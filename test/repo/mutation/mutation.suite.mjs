/**
 * @file mutation.suite.mjs
 * Mutation：commit / update（樂觀併發）/ updateFileMeta / remove / renameTag / deleteTag /
 * setTagMeta 的成功與各類預期失敗（validation / not_found / stale_update / last_tag），
 * 以及動詞後投影索引仍與真相一致。
 */

const FILE = { fileSize: 1, width: 2, height: 3, blurhash: "bh" };

export const name = "mutation (Mutation)";

export async function run(t, h) {
  const { Mutation, Query, ImageQuery, ImageWhere } = h.modules;

  /** 以某 ImageWhere 查出的 id 集合（升冪），驗投影一致性。 */
  const idsFor = (db, over) => {
    const q = new Query(db);
    return q.images(new ImageQuery(new ImageWhere(over))).items.map((i) => i.id).sort();
  };

  // ── commit：成功 + 標籤正規化 + 預設 rating ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    // 刻意亂序 + 前後空白：["  b","a","c "] → 正規化後 ["a","b","c"]
    const r = m.commitRecord("a.png", { name: "A", tags: ["  b", "a", "c "] }, FILE);
    t.ok("commit 成功", r.ok);
    t.eq("commit 回傳含 id", r.data.id, "a.png");
    t.eq("commit 標籤修剪 + 自然排序", r.data.tags, ["a", "b", "c"]);
    t.eq("commit 未給 rating 預設 0", r.data.rating, 0);
    t.eq("commit 帶入檔案側 metadata", { w: r.data.width, h: r.data.height, bh: r.data.blurhash }, { w: 2, h: 3, bh: "bh" });
    t.eq("commit 後可被查詢", idsFor(db, { includedTags: ["a"] }), ["a.png"]);
    t.eq("commit 後 committedAt === updatedAt", r.data.committedAt, r.data.updatedAt);
  }

  // ── commit：驗證失敗 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    const bad = (label, entry) => {
      const r = m.commitRecord("x.png", entry, FILE);
      t.ok(label, r.ok === false && r.error.kind === "validation");
    };
    bad("空名稱擋下", { name: "  ", tags: ["a"] });
    bad("超長名稱(>200)擋下", { name: "x".repeat(201), tags: ["a"] });
    bad("空標籤陣列擋下", { name: "N", tags: [] });
    bad("重複標籤擋下", { name: "N", tags: ["a", "a"] });
    bad("含逗號標籤擋下", { name: "N", tags: ["a,b"] });
    bad("超長標籤(>50)擋下", { name: "N", tags: ["t".repeat(51)] });
    bad("非法 rating(非整數)擋下", { name: "N", tags: ["a"], rating: 2.5 });
    bad("非法 rating(>5)擋下", { name: "N", tags: ["a"], rating: 6 });
    t.eq("驗證失敗不寫入", db.imageCount(), 0);
    // validation error 帶 fields
    const r = m.commitRecord("x.png", { name: "N", tags: [] }, FILE);
    t.eq("validation 錯誤標明欄位", r.ok === false ? r.error.fields : null, ["tags"]);
  }

  // ── commit：覆寫既有 id ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    m.commitRecord("a.png", { name: "First", tags: ["old"] }, FILE);
    const r = m.commitRecord("a.png", { name: "Second", tags: ["new"] }, FILE);
    t.ok("覆寫成功", r.ok);
    t.eq("覆寫後總數仍為 1", db.imageCount(), 1);
    t.eq("覆寫後名稱更新", db.getImage("a.png").name, "Second");
    t.eq("覆寫後舊標籤投影清空", idsFor(db, { includedTags: ["old"] }), []);
    t.eq("覆寫後新標籤投影命中", idsFor(db, { includedTags: ["new"] }), ["a.png"]);
  }

  // ── update：成功 + 部分 patch + 樂觀併發 + not_found ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    const committed = m.commitRecord("a.png", { name: "A", tags: ["x"], rating: 2 }, FILE);
    const U = committed.data.updatedAt;

    const okRes = m.updateRecord("a.png", { expectedUpdatedAt: U, rating: 4 });
    t.ok("update 成功", okRes.ok);
    t.eq("update 套用 rating", okRes.data.rating, 4);
    t.eq("update 部分 patch 不動 name", okRes.data.name, "A");
    t.ok("update 後 updatedAt 不回退", okRes.data.updatedAt >= U);

    // 用過期 expectedUpdatedAt → stale（確定性：故意給 U-1）
    const stale = m.updateRecord("a.png", { expectedUpdatedAt: U - 1, rating: 1 });
    t.ok("過期 updatedAt → stale_update", stale.ok === false && stale.error.kind === "stale_update");
    t.eq("stale 帶 actualUpdatedAt", stale.ok === false ? stale.error.actualUpdatedAt : null, okRes.data.updatedAt);

    const nf = m.updateRecord("missing.png", { expectedUpdatedAt: 0 });
    t.ok("update 不存在 → not_found", nf.ok === false && nf.error.kind === "not_found");

    // 標籤 patch 驗證失敗（先過 not_found / stale 才驗）
    const inv = m.updateRecord("a.png", { expectedUpdatedAt: okRes.data.updatedAt, tags: [] });
    t.ok("update 空標籤 → validation", inv.ok === false && inv.error.kind === "validation");
  }

  // ── update：標籤變更同步投影 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    const c = m.commitRecord("a.png", { name: "A", tags: ["old"] }, FILE);
    m.updateRecord("a.png", { expectedUpdatedAt: c.data.updatedAt, tags: ["new1", "new2"] });
    t.eq("update 後舊標籤投影清空", idsFor(db, { includedTags: ["old"] }), []);
    t.eq("update 後新標籤投影命中", idsFor(db, { includedTags: ["new1"] }), ["a.png"]);
    t.eq("update 標籤已正規化排序", db.getImage("a.png").tags, ["new1", "new2"]);
  }

  // ── updateFileMeta：不動 updatedAt、不需併發檢查、not_found ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    const c = m.commitRecord("a.png", { name: "A", tags: ["x"] }, FILE);
    const U = c.data.updatedAt;
    const r = m.updateRecordFileMeta("a.png", { width: 999, blurhash: "zzz" });
    t.ok("updateFileMeta 成功", r.ok);
    t.eq("updateFileMeta 改尺寸", r.data.width, 999);
    t.eq("updateFileMeta 改 blurhash", r.data.blurhash, "zzz");
    t.eq("updateFileMeta 不動 updatedAt", r.data.updatedAt, U);
    const nf = m.updateRecordFileMeta("missing.png", { width: 1 });
    t.ok("updateFileMeta 不存在 → not_found", nf.ok === false && nf.error.kind === "not_found");
  }

  // ── remove：回傳被刪紀錄、清投影、not_found ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    m.commitRecord("a.png", { name: "A", tags: ["x"] }, FILE);
    const r = m.removeRecord("a.png");
    t.ok("remove 成功", r.ok);
    t.eq("remove 回傳被刪紀錄的 name", r.data.name, "A");
    t.eq("remove 後總數 0", db.imageCount(), 0);
    t.eq("remove 後投影清空", idsFor(db, { includedTags: ["x"] }), []);
    const nf = m.removeRecord("a.png");
    t.ok("remove 不存在 → not_found", nf.ok === false && nf.error.kind === "not_found");
  }

  // ── renameTag ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    m.commitRecord("a.png", { name: "A", tags: ["cat", "cute"] }, FILE);
    m.commitRecord("b.png", { name: "B", tags: ["cat"] }, FILE);
    m.commitRecord("c.png", { name: "C", tags: ["dog"] }, FILE);
    m.setTagMeta("cat", { hidden: true });

    const r = m.renameTag("cat", "feline");
    t.ok("rename 成功", r.ok);
    t.eq("rename affected 計數", r.data.affected, 2);
    t.eq("rename 後 a 標籤搬移並排序", db.getImage("a.png").tags, ["cute", "feline"]);
    t.eq("rename 後 b 標籤搬移", db.getImage("b.png").tags, ["feline"]);
    t.eq("rename 未涉及者不動", db.getImage("c.png").tags, ["dog"]);
    t.eq("rename 後 metadata 搬移到新名", db.getTagMeta("feline"), { hidden: true });
    t.eq("rename 後舊名 metadata 移除", db.getTagMeta("cat"), { hidden: false });
    t.eq("rename 後投影：舊名清空", idsFor(db, { includedTags: ["cat"] }), []);
    t.eq("rename 後投影：新名命中", idsFor(db, { includedTags: ["feline"] }), ["a.png", "b.png"]);
  }

  // ── renameTag：合併重複、同名 no-op、非法、不存在 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    m.commitRecord("a.png", { name: "A", tags: ["cat", "feline"] }, FILE); // 同時有新舊名
    const merged = m.renameTag("cat", "feline");
    t.eq("rename 合併重複後標籤去重", db.getImage("a.png").tags, ["feline"]);
    t.eq("rename 合併仍計 affected", merged.data.affected, 1);

    const noop = m.renameTag("feline", "feline");
    t.ok("同名 rename 為 no-op 成功", noop.ok);
    t.eq("同名 rename affected 0", noop.data.affected, 0);

    const invalid = m.renameTag("feline", "  ");
    t.ok("rename 非法新名 → validation", invalid.ok === false && invalid.error.kind === "validation");

    const ghost = m.renameTag("ghost", "phantom");
    t.ok("rename 不存在標籤 → not_found", ghost.ok === false && ghost.error.kind === "not_found");
  }

  // ── deleteTag：成功、last_tag 守衛、移除 metadata、不存在 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    // a 有第三個標籤 extra，確保連刪 cat、cute 後仍不會變零標籤
    m.commitRecord("a.png", { name: "A", tags: ["cat", "cute", "extra"] }, FILE);
    m.commitRecord("b.png", { name: "B", tags: ["cat", "fluffy"] }, FILE);
    m.commitRecord("c.png", { name: "C", tags: ["dog", "cute"] }, FILE);
    m.commitRecord("d.png", { name: "D", tags: ["solo"] }, FILE);
    m.setTagMeta("cute", { hidden: true });

    // last_tag：刪 solo 會讓 d 變零標籤 → 擋下、不改動任何真相
    const guard = m.deleteTag("solo");
    t.ok("deleteTag 觸發 last_tag 守衛", guard.ok === false && guard.error.kind === "last_tag");
    t.eq("last_tag 帶受影響 id", guard.ok === false ? guard.error.images : null, ["d.png"]);
    t.eq("last_tag 未改動任何真相", db.getImage("d.png").tags, ["solo"]);

    // 成功刪除非最後一個標籤（a、b 皆仍有其他標籤）
    const ok = m.deleteTag("cat");
    t.ok("deleteTag 成功", ok.ok);
    t.eq("deleteTag affected", ok.data.affected, 2);
    t.eq("deleteTag 後 a 剩餘標籤", db.getImage("a.png").tags, ["cute", "extra"]);
    t.eq("deleteTag 後 b 剩餘標籤", db.getImage("b.png").tags, ["fluffy"]);
    t.eq("deleteTag 後投影清空", idsFor(db, { includedTags: ["cat"] }), []);

    // 移除 metadata：cute 由 a、c 共用，刪後兩者仍各有 extra / dog，不觸發 last_tag
    const cuteDel = m.deleteTag("cute");
    t.eq("deleteTag cute affected", cuteDel.ok ? cuteDel.data.affected : null, 2);
    t.eq("deleteTag 一併移除 metadata", db.getTagMeta("cute"), { hidden: false });

    // 不存在
    const ghost = m.deleteTag("ghost");
    t.ok("deleteTag 不存在 → not_found", ghost.ok === false && ghost.error.kind === "not_found");
  }

  // ── setTagMeta：成功 + 非法名 ──
  {
    const db = h.freshDb();
    const m = new Mutation(db);
    const r = m.setTagMeta("cat", { hidden: true });
    t.ok("setTagMeta 成功", r.ok);
    t.eq("setTagMeta 後取回", db.getTagMeta("cat"), { hidden: true });
    const bad = m.setTagMeta("", { hidden: true });
    t.ok("setTagMeta 空名 → validation", bad.ok === false && bad.error.kind === "validation");
    const comma = m.setTagMeta("a,b", { hidden: true });
    t.ok("setTagMeta 含逗號名 → validation", comma.ok === false && comma.error.kind === "validation");
  }
}

export default { name, run };
