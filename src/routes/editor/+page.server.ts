import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery, ImageWhere, ListOptions, TagFacetQuery, TagQuery, TagWhere } from "$lib/query-spec";
import { sortCollator } from "$lib/utils/shared";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");

  const query = new Query(Database.requireLoaded());
  const base = ImageQuery.fromSearchParams(url.searchParams);

  const { items: committedFiles } = query.images(base.with({ list: base.list.with({ limit: 0 }) }));
  const { items: facets } = query.facets(TagFacetQuery.fromSearchParams(url.searchParams));
  const { items: authoringTags } = query.tags(new TagQuery(new TagWhere({ universe: "all" })));

  const requestedId = url.searchParams.get("currentId");
  let resolvedId: string | null = null; // fallback: URL 指定 → 篩選結果第一張 → null

  for (const item of committedFiles) {
    if (item.id === requestedId) resolvedId = item.id;
  }

  if (!resolvedId && committedFiles.length > 0) {
    resolvedId = committedFiles[0].id;
  }

  const currentRecord = resolvedId ? query.getImage(resolvedId) : null;

  // ============================================================
  // TEMP 效能量測 — 分析「query 計算 vs 序列化」的時間佔比（plan/4）
  // 用完整段刪除即可，不影響其餘邏輯。輸出在 **伺服器終端機**。
  // ============================================================
  {
    const RUNS = 5;
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

    /** 量測一個查詢：跑 RUNS 次取平均的 query 時間與 JSON.stringify 時間 + 位元組數 + 筆數。 */
    const bench = (label: string, run: () => { items: unknown[] }) => {
      const qt: number[] = [];
      let res: { items: unknown[] } = { items: [] };
      for (let i = 0; i < RUNS; i++) {
        const t0 = performance.now();
        res = run();
        qt.push(performance.now() - t0);
      }
      const st: number[] = [];
      let json = "";
      for (let i = 0; i < RUNS; i++) {
        const t0 = performance.now();
        json = JSON.stringify(res.items);
        st.push(performance.now() - t0);
      }
      const q = avg(qt);
      const s = avg(st);
      const share = q + s > 0 ? Math.round((s / (q + s)) * 100) : 0;
      console.log(
        `[perf] ${label.padEnd(26)} query=${q.toFixed(2).padStart(7)}ms  ` +
          `serialize=${s.toFixed(2).padStart(7)}ms  (序列化佔 ${String(share).padStart(2)}%)  ` +
          `bytes=${(json.length / 1024).toFixed(1).padStart(8)}KB  items=${res.items.length}`,
      );
    };

    // 程式化挑選代表性標籤（依實際使用數），不需人工查看有哪些標籤
    const allTags = query
      .tags(new TagQuery(new TagWhere({ universe: "all" })))
      .items.filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count);
    const at = (frac: number) => allTags[Math.min(allTags.length - 1, Math.floor(allTags.length * frac))];
    const hi = allTags[0]; // 使用數最高（結果集大）
    const mid = at(0.5); // 中位（結果集中等）
    const lo = allTags[allTags.length - 1]; // 使用數最低（結果集小）

    const imagesAll = (w: ImageWhere) =>
      query.images(new ImageQuery(w, new ListOptions({ sort: "committedAt", order: "desc", limit: 0 })));

    console.log(`\n[perf] ===== editor load 效能量測（每項 ${RUNS} 次平均）=====`);
    console.log(
      `[perf] 標籤總數=${allTags.length}  hi="${hi?.name}"(${hi?.count})  ` +
        `mid="${mid?.name}"(${mid?.count})  lo="${lo?.name}"(${lo?.count})`,
    );

    // (1) 目前 editor load 實際回傳的三個組成
    bench("committedFiles(全部)", () => imagesAll(new ImageWhere()));
    bench("facets(全部)", () => query.facets(TagFacetQuery.fromSearchParams(url.searchParams)));
    bench("authoringTags(全部)", () => query.tags(new TagQuery(new TagWhere({ universe: "all" }))));

    // (2) 標籤篩選：不同結果集大小下，query vs serialize 佔比如何變化
    if (hi) bench(`images incl[${hi.name}]`, () => imagesAll(new ImageWhere({ includedTags: [hi.name] })));
    if (mid) bench(`images incl[${mid.name}]`, () => imagesAll(new ImageWhere({ includedTags: [mid.name] })));
    if (lo) bench(`images incl[${lo.name}]`, () => imagesAll(new ImageWhere({ includedTags: [lo.name] })));

    // ── 分解 authoringTags 的 ~13ms：逐步加回每個成分，看各佔多少 ──
    const db = Database.requireLoaded();
    const timeit = (label: string, fn: () => unknown[]) => {
      const ts: number[] = [];
      let out: unknown[] = [];
      for (let i = 0; i < RUNS; i++) {
        const t0 = performance.now();
        out = fn();
        ts.push(performance.now() - t0);
      }
      console.log(`[perf/decomp] ${label.padEnd(30)} ${avg(ts).toFixed(2).padStart(7)}ms  (n=${out.length})`);
    };

    console.log(`[perf/decomp] ----- 分解 standalone 標籤查詢 -----`);
    // V0：對照組——用舊的 bits.size() popcount（優化 A 前的做法）
    timeit("V0 size() popcount", () => {
      const a: { name: string; count: number }[] = [];
      for (const [name, bits] of db.tagBitsEntries()) a.push({ name, count: bits.size() });
      return a;
    });
    // V1：只迭代 + 快取 count（優化 A 後）
    timeit("V1 迭代+快取count", () => {
      const a: { name: string; count: number }[] = [];
      for (const [name] of db.tagBitsEntries()) a.push({ name, count: db.tagCount(name) });
      return a;
    });
    // V2：+ getTagMeta（每標籤 hydrate 一個 meta 物件）
    timeit("V2 +getTagMeta", () => {
      const a: unknown[] = [];
      for (const [name] of db.tagBitsEntries()) a.push({ name, count: db.tagCount(name), meta: db.getTagMeta(name) });
      return a;
    });
    // V3：+ 排序（= 完整 standalone 等價）
    timeit("V3 +排序(=standalone)", () => {
      const a: { name: string; count: number; meta: unknown }[] = [];
      for (const [name] of db.tagBitsEntries()) a.push({ name, count: db.tagCount(name), meta: db.getTagMeta(name) });
      a.sort((x, y) => y.count - x.count || sortCollator.compare(x.name, y.name));
      return a;
    });
    console.log(`[perf] =====================================================\n`);
  }
  // ============================================================
  // TEMP 效能量測結束
  // ============================================================

  return { committedFiles, currentRecord, facets, authoringTags };
};
