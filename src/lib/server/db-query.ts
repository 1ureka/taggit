/**
 * @file db-query.ts
 * 圖片資料庫的唯讀查詢函式。
 *
 * 每個函式都接受 {@link JSONDatabase} 作為第一個參數，
 * 不依賴模組層級的 singleton，方便測試與替換。
 */

import type { JSONDatabase } from "./db.js";
import type { ImageWithId, QueryOptions, QueryResult, SortField } from "$lib/types.js";
import type { TagImageSample, TagInfo, TagQueryOptions, TagQueryResult } from "$lib/types.js";
import type { TagSampleMode, TagSortField, TagWithSamples } from "$lib/types.js";
import { isNonEmpty, sortCollator } from "$lib/utils.js";

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
 * 對多個標籤取交集，任一標籤不存在就直接回傳空集合。
 */
function intersectTags(jsonDB: JSONDatabase, tags: [string, ...string[]]): Set<string> {
  const tagSets: Set<string>[] = [];

  // 如果有任何一個標籤不存在，交集必為空
  for (const t of tags) {
    const set = jsonDB.tagIndex.get(t);
    if (!set) return new Set();
    tagSets.push(new Set(set));
  }

  // 以集合大小排序，先處理較小的集合可以快速縮小交集範圍
  tagSets.sort((a, b) => a.size - b.size);

  return tagSets.reduce((acc, current) => acc.intersection(current));
}

/**
 * 對多個標籤取差集，任一標籤不存在則忽略。
 */
function differenceTags(jsonDB: JSONDatabase, tags: [string, ...string[]], base: Set<string>): Set<string> {
  for (const t of tags) {
    const set = jsonDB.tagIndex.get(t);
    if (!set) continue;

    base = base.difference(new Set(set));
    if (base.size === 0) break;
  }

  return base;
}

// ---

/**
 * 篩選圖片的參數型別
 */
interface FilterParams {
  /** 不區分大小寫的名稱子字串搜尋 */
  search: string;
  /** 必須同時包含的標籤（AND 語意） */
  includedTags: string[];
  /** 必須排除的標籤（NOT 語意） */
  excludedTags: string[];
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
  let ids: Set<string>;

  // 1. 起始集合：有指定標籤就取交集，否則全部
  if (isNonEmpty(f.includedTags)) {
    ids = intersectTags(jsonDB, f.includedTags);
  } else {
    ids = new Set(Object.keys(images));
  }

  if (ids.size === 0) return ids;

  // 2. 排除指定標籤
  if (isNonEmpty(f.excludedTags)) {
    ids = differenceTags(jsonDB, f.excludedTags, ids);
  }

  if (ids.size === 0) return ids;

  // 3. 名稱子字串篩選
  if (f.search) {
    for (const id of ids) {
      const name = (images[id].name ?? "").toLowerCase();
      if (!name.includes(f.search)) ids.delete(id);
    }
  }

  if (ids.size === 0) return ids;

  // 4. 評分篩選
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
function sortKey(img: ImageWithId, sort: Omit<SortField, "random">): string {
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

interface TagSummary extends TagInfo {
  lastUsedAt: number;
  ids: string[];
}

/**
 * 產生穩定的 32-bit hash，用於讓標籤樣本看起來像抽樣但不隨 request 跳動。
 */
function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tagSortKey(tag: TagSummary, sort: Omit<TagSortField, "random">): string {
  if (sort === "count") return String(tag.count);
  if (sort === "recent") return String(tag.lastUsedAt);
  return tag.name.toLowerCase();
}

function sortTags(items: TagSummary[], sort: TagSortField, order: "asc" | "desc"): TagSummary[] {
  const newItems = [...items];

  if (sort === "random") {
    shuffle(newItems);
    return newItems;
  }

  const dir = order === "asc" ? 1 : -1;

  newItems.sort((a, b) => {
    if (sort !== "name") {
      const primaryResult = dir * sortCollator.compare(tagSortKey(a, sort), tagSortKey(b, sort));
      if (primaryResult !== 0) return primaryResult;
    }

    return dir * sortCollator.compare(tagSortKey(a, "name"), tagSortKey(b, "name"));
  });

  return newItems;
}

function toSample(jsonDB: JSONDatabase, id: string): TagImageSample | null {
  const record = jsonDB.data.images[id];
  if (!record) return null;

  return { id, name: record.name, width: record.width, height: record.height, blurhash: record.blurhash };
}

function sampleImageIds(
  jsonDB: JSONDatabase,
  tagName: string,
  ids: string[],
  limit: number,
  mode: TagSampleMode,
): string[] {
  if (limit <= 0 || ids.length === 0) return [];

  const newIds = ids.filter((id) => id in jsonDB.data.images);

  if (mode === "random") {
    shuffle(newIds);
  } else if (mode === "recent") {
    newIds.sort((a, b) => {
      const result = sortCollator.compare(
        String(jsonDB.data.images[b].committedAt),
        String(jsonDB.data.images[a].committedAt),
      );
      return result || sortCollator.compare(a, b);
    });
  } else {
    newIds.sort((a, b) => {
      const result = stableHash(`${tagName}\0${a}`) - stableHash(`${tagName}\0${b}`);
      return result || sortCollator.compare(a, b);
    });
  }

  return newIds.slice(0, limit);
}

function withSamples(
  jsonDB: JSONDatabase,
  tag: TagSummary,
  sampleLimit: number,
  sampleMode: TagSampleMode,
): TagWithSamples {
  const samples = sampleImageIds(jsonDB, tag.name, tag.ids, sampleLimit, sampleMode)
    .map((id) => toSample(jsonDB, id))
    .filter((sample): sample is TagImageSample => sample !== null);

  return { name: tag.name, count: tag.count, lastUsedAt: tag.lastUsedAt, samples };
}

/**
 * 根據指定的 sort 欄位和 order 方向對圖片陣列排序。
 */
function sortImages(items: ImageWithId[], sort: SortField, order: "asc" | "desc"): ImageWithId[] {
  const newItems = [...items];

  if (sort === "random") {
    shuffle(newItems);
    return newItems;
  }

  const dir = order === "asc" ? 1 : -1;

  newItems.sort((a, b) => {
    if (sort !== "name") {
      const primaryResult = dir * sortCollator.compare(sortKey(a, sort), sortKey(b, sort));
      if (primaryResult !== 0) return primaryResult;
    }

    return dir * sortCollator.compare(sortKey(a, "name"), sortKey(b, "name"));
  });

  return newItems;
}

// ---

/**
 * 統一圖片查詢：篩選 + 排序 + 分頁。
 * `limit > 0` 時分頁；`limit` 為 0 或省略時回傳全部。
 */
export function queryImages(jsonDB: JSONDatabase, opts: QueryOptions = {}): QueryResult {
  const search = opts.search?.trim().toLowerCase() ?? "";
  const includedTags = opts.includedTags ?? [];
  const excludedTags = opts.excludedTags ?? [];
  const rating = opts.rating;
  const ratingOp = opts.ratingOp ?? "gte";
  const sort = opts.sort ?? "rating";
  const order = opts.order ?? "desc";
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;
  const page = Math.max(1, opts.page ?? 1);

  const ids = filterIds(jsonDB, { search, includedTags, excludedTags, rating, ratingOp });
  let items: ImageWithId[] = [...ids].map((id) => ({ id, ...jsonDB.data.images[id] }));

  items = sortImages(items, sort, order);

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

// ---

/**
 * 統一標籤查詢：篩選 + 排序 + 分頁 + 樣本圖片。
 * `limit > 0` 時分頁；`limit` 為 0 或省略時回傳全部。
 */
export function queryTags(jsonDB: JSONDatabase, opts: TagQueryOptions = {}): TagQueryResult {
  const search = opts.search?.trim().toLowerCase() ?? "";
  const minCount = opts.minCount !== undefined ? Math.max(0, opts.minCount) : undefined;
  const maxCount = opts.maxCount !== undefined ? Math.max(0, opts.maxCount) : undefined;
  const sort = opts.sort ?? "count";
  const order = opts.order ?? "desc";
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;
  const page = Math.max(1, opts.page ?? 1);
  const sampleLimit = Math.min(12, Math.max(0, opts.sampleLimit ?? 0));
  const sampleMode = opts.sampleMode ?? "stable";

  if (minCount !== undefined && maxCount !== undefined && minCount > maxCount) {
    return { items: [], total: 0, page: 1, pages: 1 };
  }

  let summaries: TagSummary[] = [];

  for (const [name, idSet] of jsonDB.tagIndex) {
    if (search && !name.toLowerCase().includes(search)) continue;

    const ids = [...idSet];
    const count = ids.length;

    if (minCount !== undefined && count < minCount) continue;
    if (maxCount !== undefined && count > maxCount) continue;

    let lastUsedAt = 0;
    for (const id of ids) {
      const committedAt = jsonDB.data.images[id]?.committedAt ?? 0;
      if (committedAt > lastUsedAt) lastUsedAt = committedAt;
    }

    summaries.push({ name, count, lastUsedAt, ids });
  }

  summaries = sortTags(summaries, sort, order);

  const total = summaries.length;

  if (limit > 0) {
    const pages = Math.max(1, Math.ceil(total / limit));
    const clampedPage = Math.min(page, pages);
    const start = (clampedPage - 1) * limit;
    const items = summaries.slice(start, start + limit).map((tag) => withSamples(jsonDB, tag, sampleLimit, sampleMode));
    return { items, total, page: clampedPage, pages };
  }

  const items = summaries.map((tag) => withSamples(jsonDB, tag, sampleLimit, sampleMode));
  return { items, total, page: 1, pages: 1 };
}
