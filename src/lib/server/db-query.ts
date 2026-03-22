/**
 * @file db-query.ts
 * 圖片資料庫的唯讀查詢函式。
 *
 * 每個函式都接受 {@link JSONDatabase} 作為第一個參數，
 * 不依賴模組層級的 singleton，方便測試與替換。
 */

import type { JSONDatabase } from "./db.js";
import type { ImageWithId, QueryOptions, QueryResult, TagInfo } from "$lib/types.js";
import { sortCollator } from "$lib/utils.js";

// ---

/**
 * 取得單張圖片（含 id），找不到回傳 `null`。
 */
export function getImageRecord(jsonDB: JSONDatabase, id: string): ImageWithId | null {
  const rec = jsonDB.data.images[id];
  return rec ? { id, ...rec } : null;
}

/**
 * 已提交圖片的總數。
 */
export function getImageCount(jsonDB: JSONDatabase): number {
  return Object.keys(jsonDB.data.images).length;
}

/**
 * 檢查資料庫是否存在指定 id。
 */
export function hasImage(jsonDB: JSONDatabase, id: string): boolean {
  return id in jsonDB.data.images;
}

// ---

/**
 * 回傳所有標籤，依圖片數量降序排列。
 */
export function getAllTags(jsonDB: JSONDatabase): TagInfo[] {
  const result: TagInfo[] = [];

  for (const [name, ids] of jsonDB.tagIndex) {
    result.push({ name, count: ids.size });
  }

  return result.sort((a, b) => b.count - a.count);
}

/**
 * 目前使用中的不重複標籤數。
 */
export function getTagCount(jsonDB: JSONDatabase): number {
  return jsonDB.tagIndex.size;
}

// ---

/**
 * 對多個標籤取交集，任一標籤不存在就直接回傳空集合。
 */
function intersectTags(jsonDB: JSONDatabase, tags: string[]): Set<string> {
  const tagSets = tags.map((t) => jsonDB.tagIndex.get(t) ?? new Set<string>());

  if (tagSets.some((s) => s.size === 0)) return new Set();

  const result = new Set(tagSets[0]);
  for (let i = 1; i < tagSets.length; i++) {
    for (const id of result) {
      if (!tagSets[i].has(id)) result.delete(id);
    }
  }
  return result;
}

// ---

/**
 * 篩選圖片的參數型別
 */
interface FilterParams {
  /** 不區分大小寫的名稱子字串搜尋 */
  search: string;
  /** 必須同時包含的標籤（AND 語意） */
  tags: string[];
  /** 評分門檻或精確值 */
  rating: number | undefined;
  /** 評分比較運算子 */
  ratingOp: "gte" | "lte" | "eq";
}

/**
 * 依搜尋、標籤、評分條件篩選，回傳符合的 id 集合。
 */
function filterIds(jsonDB: JSONDatabase, f: FilterParams): Set<string> {
  const images = jsonDB.data.images;

  // 1. 起始集合：有指定標籤就取交集，否則全部
  const ids = f.tags.length > 0 ? intersectTags(jsonDB, f.tags) : new Set(Object.keys(images));

  // 2. 名稱子字串篩選
  if (f.search) {
    for (const id of ids) {
      const name = (images[id].name ?? "").toLowerCase();
      if (!name.includes(f.search)) ids.delete(id);
    }
  }

  // 3. 評分篩選
  if (f.rating !== undefined) {
    for (const id of ids) {
      const r = images[id].rating ?? 0;
      const keep = f.ratingOp === "gte" ? r >= f.rating : f.ratingOp === "lte" ? r <= f.rating : r === f.rating;
      if (!keep) ids.delete(id);
    }
  }

  return ids;
}

// ---

/**
 * 從圖片取出用於排序的值。
 */
function sortKey(img: ImageWithId, sort: "committedAt" | "rating" | "name"): string {
  if (sort === "rating") return String(img.rating ?? 0);
  if (sort === "name") return (img.name ?? "").toLowerCase();
  return String(img.committedAt ?? 0);
}

/**
 * Fisher-Yates 洗牌。
 */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---

/**
 * 統一圖片查詢：篩選 + 排序 + 分頁。
 * `limit > 0` 時分頁；`limit` 為 0 或省略時回傳全部。
 */
export function queryImages(jsonDB: JSONDatabase, opts: QueryOptions = {}): QueryResult {
  const search = opts.search?.trim().toLowerCase() ?? "";
  const tags = opts.tags ?? [];
  const rating = opts.rating;
  const ratingOp = opts.ratingOp ?? "gte";
  const sort = opts.sort ?? "committedAt";
  const order = opts.order ?? "desc";
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;
  const page = Math.max(1, opts.page ?? 1);

  // 1. 篩選
  const ids = filterIds(jsonDB, { search, tags, rating, ratingOp });
  let items: ImageWithId[] = [...ids].map((id) => ({ id, ...jsonDB.data.images[id] }));

  // 2. 排序
  if (sort === "random") {
    shuffle(items);
  } else {
    const dir = order === "asc" ? 1 : -1;
    items.sort((a, b) => dir * sortCollator.compare(sortKey(a, sort), sortKey(b, sort)));
  }

  // 3. 分頁
  const total = items.length;

  if (limit > 0) {
    const pages = Math.max(1, Math.ceil(total / limit));
    const clampedPage = Math.min(page, pages);
    const start = (clampedPage - 1) * limit;
    items = items.slice(start, start + limit);
    return { items, total, page: clampedPage, pages };
  }

  return { items, total, page: 1, pages: 1 };
}
