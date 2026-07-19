import { json, type RequestHandler } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery, ImageWhere, ListOptions, TagFacetQuery, TagQuery, TagWhere } from "$lib/query-spec";

/**
 * `GET /api/perf` — 診斷用查詢效能量測（非正式端點）。
 *
 * 對目前載入的 collection 量測各主要讀取查詢的「計算 vs 序列化」時間佔比，
 * 回傳 JSON 供瀏覽器直接檢視。標籤篩選案例的標籤依實際使用數自動挑選。
 *
 * 用途：驗證索引/查詢層改動的效能，例如 facets 捷徑（見 plan/5）。
 */
export const GET: RequestHandler = () => {
  if (!Database.isLoaded()) return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });

  const RUNS = 5;
  const query = new Query(Database.requireLoaded());
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

  /** 量測一個查詢：RUNS 次平均的 query 時間、JSON.stringify 時間、位元組數、筆數。 */
  const bench = (label: string, run: () => { items: unknown[] }) => {
    const qt: number[] = [];
    let res: { items: unknown[] } = { items: [] };
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      res = run();
      qt.push(performance.now() - t0);
    }
    const st: number[] = [];
    let bytes = 0;
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      bytes = JSON.stringify(res.items).length;
      st.push(performance.now() - t0);
    }
    const q = avg(qt);
    const s = avg(st);
    return {
      label,
      queryMs: +q.toFixed(2),
      serializeMs: +s.toFixed(2),
      serializePct: q + s > 0 ? Math.round((s / (q + s)) * 100) : 0,
      bytesKB: +(bytes / 1024).toFixed(1),
      items: res.items.length,
    };
  };

  // 依實際使用數挑代表標籤（高/中/低），不需人工指定
  const allTags = query
    .tags(new TagQuery(new TagWhere({ universe: "all" })))
    .items.filter((tg) => tg.count > 0)
    .sort((a, b) => b.count - a.count);
  const at = (frac: number) => allTags[Math.min(allTags.length - 1, Math.floor(allTags.length * frac))];
  const hi = allTags[0];
  const mid = at(0.5);
  const lo = allTags[allTags.length - 1];

  const imagesAll = (where: ImageWhere) =>
    query.images(new ImageQuery(where, new ListOptions({ sort: "committedAt", order: "desc", limit: 0 })));

  const results = [
    bench("committedFiles(all)", () => imagesAll(new ImageWhere())),
    bench("facets(all)", () => query.facets(new TagFacetQuery(new ImageWhere()))),
    bench("authoringTags(all)", () => query.tags(new TagQuery(new TagWhere({ universe: "all" })))),
    // 標籤篩選：不同結果集大小下 query vs serialize 佔比
    ...(hi ? [bench(`images incl[${hi.name}]`, () => imagesAll(new ImageWhere({ includedTags: [hi.name] })))] : []),
    ...(mid ? [bench(`images incl[${mid.name}]`, () => imagesAll(new ImageWhere({ includedTags: [mid.name] })))] : []),
    ...(lo ? [bench(`images incl[${lo.name}]`, () => imagesAll(new ImageWhere({ includedTags: [lo.name] })))] : []),
  ];

  return json({
    ok: true,
    runs: RUNS,
    tags: {
      total: allTags.length,
      hi: hi ? { name: hi.name, count: hi.count } : null,
      mid: mid ? { name: mid.name, count: mid.count } : null,
      lo: lo ? { name: lo.name, count: lo.count } : null,
    },
    results,
  });
};
