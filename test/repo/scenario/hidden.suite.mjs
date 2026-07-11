/**
 * @file hidden.suite.mjs
 * hidden 標籤語義的完整情境。
 *
 * 規則（scope.ts）：設 H = hidden 標籤集合、Q = 查詢的 includedTags，
 * 圖片被遮蔽 ⇔ 存在 h ∈ H 使圖片擁有 h 且 h ∉ Q。
 *
 * - images：一律用「遮蔽後」的 visible 集合（image 側不遮蔽會直接洩漏隱藏圖）。
 * - facets：hidden 且未 included 的標籤，count = 「解鎖後會有幾張」的投影數；
 *           其餘標籤 = 遮蔽後計數。
 * - tags（獨立列表）：count = 原始總使用數，完全不遮蔽。
 * - getImageCount：原始總數，不受 hidden 影響。
 */

export const name = "hidden (masking scenarios)";

/**
 * 標準 fixture：
 *   A: [common, secret]   B: [common]   C: [secret]   D: [common, nsfw]
 * hidden = { secret, nsfw }。名稱 = id，rating 全 0（排序 tie-break 走 name asc）。
 */
function standard(h) {
  const db = h.freshDb();
  h.putImage(db, "A", { tags: ["common", "secret"] });
  h.putImage(db, "B", { tags: ["common"] });
  h.putImage(db, "C", { tags: ["secret"] });
  h.putImage(db, "D", { tags: ["common", "nsfw"] });
  db.setTagMeta("secret", { hidden: true });
  db.setTagMeta("nsfw", { hidden: true });
  return db;
}

export async function run(t, h) {
  const { Query, ImageQuery, ImageWhere, TagQuery, TagWhere, TagFacetQuery } = h.modules;

  const imgIds = (q, over) => q.images(new ImageQuery(new ImageWhere(over))).items.map((i) => i.id);
  const facetPairs = (q, scopeOver, whereOver) =>
    q
      .facets(new TagFacetQuery(new ImageWhere(scopeOver), new TagQuery(new TagWhere(whereOver ?? {}))))
      .items.map((tg) => `${tg.name}:${tg.count}`)
      .sort();
  const tagPairs = (q, whereOver) =>
    q
      .tags(new TagQuery(new TagWhere(whereOver ?? {})))
      .items.map((tg) => `${tg.name}:${tg.count}`)
      .sort();

  // ── images 側遮蔽 ──────────────────────────────────────────────────────
  {
    const q = new Query(standard(h));

    // 空查詢：擁有任一 hidden 標籤的 A/C/D 全遮蔽，只剩純 common 的 B。
    t.eq("空查詢只見未隱藏圖", imgIds(q).sort(), ["B"]);

    // 明確 include hidden 標籤 → 該標籤豁免遮罩（解鎖）。
    t.eq("include secret 解鎖 A、C（但 D 仍因 nsfw 被遮）", imgIds(q, { includedTags: ["secret"] }).sort(), ["A", "C"]);

    // include 一個可見標籤不會解鎖 hidden：A（有 secret）、D（有 nsfw）仍遮蔽。
    t.eq("include common 不解鎖 hidden，仍只剩 B", imgIds(q, { includedTags: ["common"] }).sort(), ["B"]);

    // 同時 include common + secret：A 兩條件皆滿足且 secret 已解鎖 → 可見。
    t.eq("include common+secret → A 可見", imgIds(q, { includedTags: ["common", "secret"] }).sort(), ["A"]);

    // 排除 common：只剩 C，但 C 有 secret 未 include → 被遮 → 空。
    t.eq("exclude common 後剩下的 C 仍被 secret 遮蔽 → 空", imgIds(q, { excludedTags: ["common"] }), []);

    // getImageCount 為原始總數，不受 hidden 影響。
    t.eq("getImageCount 不受 hidden 影響", q.getImageCount(), 4);
    t.eq("getAllImages 不遮蔽（維護掃描用）", q.getAllImages().length, 4);
  }

  // ── 多個 hidden 標籤：聯集遮罩、部分解鎖仍被另一個遮 ──────────────────
  {
    const db = h.freshDb();
    h.putImage(db, "X", { tags: ["nsfw", "secret"] }); // 同時擁有兩個 hidden 標籤
    db.setTagMeta("secret", { hidden: true });
    db.setTagMeta("nsfw", { hidden: true });
    const q = new Query(db);

    t.eq("同時具兩 hidden 標籤，空查詢被遮", imgIds(q), []);
    t.eq("只解鎖 secret，仍被 nsfw 遮蔽", imgIds(q, { includedTags: ["secret"] }), []);
    t.eq("兩個 hidden 標籤都解鎖才可見", imgIds(q, { includedTags: ["secret", "nsfw"] }), ["X"]);
  }

  // ── hidden × rating 交互 ───────────────────────────────────────────────
  {
    const db = h.freshDb();
    h.putImage(db, "A", { tags: ["common", "secret"], rating: 5 });
    h.putImage(db, "B", { tags: ["common"], rating: 3 });
    db.setTagMeta("secret", { hidden: true });
    const q = new Query(db);

    t.eq("rating≥4 命中 A 但被 secret 遮蔽 → 空", imgIds(q, { rating: 4, ratingOp: "gte" }), []);
    t.eq("rating≥4 且 include secret → A 可見", imgIds(q, { rating: 4, ratingOp: "gte", includedTags: ["secret"] }), ["A"]);
  }

  // ── facets 計數語義 ────────────────────────────────────────────────────
  {
    const q = new Query(standard(h));

    // 空 scope：
    //  common=1（遮蔽後只有 B 可見且含 common）
    //  secret=2（解鎖投影：點 secret 後 A、C 皆會出現）
    //  nsfw=1（解鎖投影：點 nsfw 後 D 出現）
    t.eq("facet 空 scope 計數", facetPairs(q, {}), ["common:1", "nsfw:1", "secret:2"]);

    // scope=include common：
    //  common=1(B)；secret=1（common 範圍內點 secret 只會多出 A）；nsfw=1（多出 D）
    t.eq("facet scope=[common] 計數", facetPairs(q, { includedTags: ["common"] }), ["common:1", "nsfw:1", "secret:1"]);

    // scope=include secret（secret 已解鎖）：
    //  common=1（A 可見且含 common）；secret=2（A、C 皆在 scope 內可見）；nsfw=0 → 濾除
    t.eq("facet scope=[secret] 計數（secret 解鎖）", facetPairs(q, { includedTags: ["secret"] }), ["common:1", "secret:2"]);

    // facet 的 TagWhere.hidden=true：只列 hidden 標籤，計數仍走 facet 語義
    t.eq("facet 只列 hidden 標籤", facetPairs(q, {}, { hidden: true }), ["nsfw:1", "secret:2"]);
    t.eq("facet 只列非 hidden 標籤", facetPairs(q, {}, { hidden: false }), ["common:1"]);

    // meta 隨結果附帶
    const secretTag = q
      .facets(new TagFacetQuery(new ImageWhere({})))
      .items.find((tg) => tg.name === "secret");
    t.eq("facet 結果附帶標籤 meta", secretTag?.meta, { hidden: true });
  }

  // ── tags 獨立列表：完全不遮蔽（原始總使用數）──────────────────────────
  {
    const q = new Query(standard(h));
    t.eq("standalone count = 原始總使用數（不遮蔽）", tagPairs(q), ["common:3", "nsfw:1", "secret:2"]);
    t.eq("standalone hidden=true 只列 hidden", tagPairs(q, { hidden: true }), ["nsfw:1", "secret:2"]);
    t.eq("standalone hidden=false 只列非 hidden", tagPairs(q, { hidden: false }), ["common:3"]);
  }

  // ── 動態切換 hidden：遮蔽即時反映 ──────────────────────────────────────
  {
    const db = standard(h);
    const q = new Query(db);
    t.eq("初始只見 B", imgIds(q).sort(), ["B"]);

    // 取消 secret 的 hidden：A、C 解除遮蔽（D 仍被 nsfw 遮）
    db.setTagMeta("secret", { hidden: false });
    t.eq("取消 secret hidden 後 A、C 現身", imgIds(q).sort(), ["A", "B", "C"]);

    // 再取消 nsfw：全部可見
    db.setTagMeta("nsfw", { hidden: false });
    t.eq("兩者都取消後全部可見", imgIds(q).sort(), ["A", "B", "C", "D"]);

    // 重新標記 common 為 hidden：含 common 的 A、B、D 被遮，只剩純 secret 的 C
    db.setTagMeta("common", { hidden: true });
    t.eq("改標 common 為 hidden 後只剩 C", imgIds(q).sort(), ["C"]);
  }

  // ── 未被使用、僅有 metadata 的 hidden 標籤（universe=all）──────────────
  {
    const db = standard(h);
    db.setTagMeta("archived", { hidden: true }); // 沒有任何圖片使用
    const q = new Query(db);
    t.ok("universe=used 不含未使用 hidden 標籤", tagPairs(q).every((s) => !s.startsWith("archived:")));
    const all = q.tags(new TagQuery(new TagWhere({ universe: "all", name: "archived" })));
    t.eq("universe=all 併入未使用 hidden 標籤（count 0）", all.items.map((tg) => `${tg.name}:${tg.count}`), ["archived:0"]);
  }
}

export default { name, run };
