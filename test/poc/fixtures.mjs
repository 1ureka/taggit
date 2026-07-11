/**
 * @file poc/fixtures.mjs
 * poc 領域的 fixtures：載入 database / query / mutation / query-spec 模組，並提供
 * db 隔離工具。建立在 core/loader.mjs 之上（拿它的 load 與 tmpRoot），交給本領域的
 * suite 當第二個參數 h 使用。
 *
 * 新增一個後端領域（例如 collection / image）時，仿此檔在該領域資料夾放一支
 * fixtures.mjs，用同一個 loader 載入該領域模組並回傳自己的工具即可。
 */

import path from "node:path";
import fs from "node:fs";

/**
 * @param {{ load: (p: string) => Promise<any>, tmpRoot: string }} loader core/loader.mjs 的產物
 * @returns fixtures 物件 h：{ modules, freshDb, seedFile, putImage, newDbPath }
 */
export async function createPocFixtures(loader) {
  const { load, tmpRoot } = loader;

  const [database, querySpec, query, mutation, bitmap, ordinal, facetIndex, serialization, searchParams] =
    await Promise.all([
      load("/src/lib/poc/database/index.ts"),
      load("/src/lib/poc/query-spec/index.ts"),
      load("/src/lib/poc/query/index.ts"),
      load("/src/lib/poc/mutation/index.ts"),
      load("/src/lib/poc/database/bitmap.ts"),
      load("/src/lib/poc/database/ordinal.ts"),
      load("/src/lib/poc/database/facet-index.ts"),
      load("/src/lib/poc/database/serialization.ts"),
      load("/src/lib/poc/query-spec/search-params.ts"),
    ]);

  const modules = {
    ...database, // Database, BitSet
    ...querySpec, // ImageWhere, TagWhere, ListOptions, ImageQuery, TagQuery, ...
    ...query, // Query
    ...mutation, // Mutation
    ...searchParams, // parseTags, safeInt, parseEnum, parseBool, ...
    OrdinalRegistry: ordinal.OrdinalRegistry,
    FacetIndex: facetIndex.FacetIndex,
    serialization, // emptyDBData, parseDBData, TagMetaCodec
  };

  let counter = 0;
  const { Database } = modules;

  /** 產生一條唯一 db.json 路徑（不同路徑 → ensureLoaded 會重載，達成隔離）。 */
  const newDbPath = () => path.join(tmpRoot, `poc-db-${counter++}.json`);

  /** 全新空 db，回傳已載入的實例。 */
  const freshDb = () => {
    Database.ensureLoaded(newDbPath());
    return Database.requireLoaded();
  };

  /** 先把 dataObj 寫成 db.json 再載入，回傳實例。用於序列化相容性測試。 */
  const seedFile = (dataObj) => {
    const p = newDbPath();
    fs.writeFileSync(p, JSON.stringify(dataObj), "utf8");
    Database.ensureLoaded(p);
    return Database.requireLoaded();
  };

  /**
   * 直接寫一筆圖片真相 + 同步投影（繞過 mutation 驗證），欄位有預設值。
   * 供 query / hidden 測試造穩定 fixture、精準控制 committedAt / rating。
   */
  const putImage = (db, id, rec = {}) => {
    const old = db.getImage(id);
    const full = {
      name: id,
      tags: [],
      rating: 0,
      committedAt: 0,
      updatedAt: 0,
      fileSize: 0,
      width: 0,
      height: 0,
      blurhash: "",
      ...rec,
    };
    db.setImage(id, full);
    db.replaceIndex(id, old);
    return full;
  };

  return { modules, freshDb, seedFile, putImage, newDbPath };
}
