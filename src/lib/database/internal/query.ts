/**
 * @file query.ts
 * 圖片與標籤的唯讀查詢 —— 以位元圖為基礎的 faceted 查詢管線。
 *
 * 每個函式都接受 {@link Database} 作為第一個參數，
 * 不依賴模組層級的 singleton，方便測試與替換。
 *
 * hidden 語義：設 H = hidden 標籤集合、Q = 查詢的 includedTags，
 * 圖片被遮蔽 ⇔ 存在 h ∈ H 使圖片擁有 h 且 h ∉ Q。
 * 被遮蔽的圖片不出現在任何輸出中（items、total、facets、標籤計數與樣本）。
 */

import { BitSet } from "./bitmap.js";
import type { Database } from "./store.js";
import type { ImageWithId, QueryOptions, QueryResult, SortField, TagFacet } from "./types.js";
import type { TagImageSample, TagQueryOptions, TagQueryResult } from "./types.js";
import type { TagSampleMode, TagSortField, TagWithSamples } from "./types.js";
import { isNonEmpty, sortCollator } from "$lib/utils/shared.js";

// ---

/**
 * 取得單張圖片（含 id），找不到回傳 `null`。
 */
export function getImageRecord(db: Database, id: string): ImageWithId | null {
  const rec = db.data.images[id];
  return rec ? { id, ...rec } : null;
}

/**
 * 已提交圖片的總數（不受 hidden 遮蔽影響的原始數量）。
 */
export function getImageCount(db: Database): number {
  return Object.keys(db.data.images).length;
}

/**
 * 檢查資料庫是否存在指定 id。
 */
export function hasImage(db: Database, id: string): boolean {
  return id in db.data.images;
}

/**
 * 回傳全部圖片紀錄（含 id），不套用任何篩選與 hidden 遮蔽。
 * 僅供維護用途（missing / metadata 掃描）使用。
 */
export function getAllImages(db: Database): ImageWithId[] {
  return Object.entries(db.data.images).map(([id, rec]) => ({ id, ...rec }));
}

// ---

/**
 * 計算 hidden 遮罩：所有「hidden 且 ∉ exclude」標籤位元圖的聯集。
 * 沒有適用的 hidden 標籤時回傳 `null`。
 */
function hiddenMask(db: Database, exclude: ReadonlySet<string>): BitSet | null {
  let mask: BitSet | null = null;

  for (const name of db.hiddenTagNames()) {
    if (exclude.has(name)) continue;

    const bits = db.facets.getTagBits(name);
    if (!bits) continue;

    if (!mask) mask = new BitSet();
    mask.orInPlace(bits);
  }

  return mask;
}

/**
 * 篩選圖片的正規化參數。
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
 * 執行管線的第 1–3 步（含 rating 與 search，不含 hidden 遮罩）：
 * live ∩ includes ∖ excludes ∩ rating，再以名稱子字串後置過濾。
 * 回傳的位元圖為新配置，呼叫端可安全改動。
 */
function filterBitmapBeforeHidden(db: Database, f: FilterParams): BitSet {
  let result = db.ordinals.live.clone();

  // 1. 包含標籤：AND；任一標籤不存在，交集必為空
  if (isNonEmpty(f.includedTags)) {
    for (const tag of f.includedTags) {
      const bits = db.facets.getTagBits(tag);
      if (!bits) return new BitSet();
      result.andInPlace(bits);
    }
  }

  // 2. 排除標籤：ANDNOT；不存在則忽略
  if (isNonEmpty(f.excludedTags)) {
    for (const tag of f.excludedTags) {
      const bits = db.facets.getTagBits(tag);
      if (bits) result.andNotInPlace(bits);
    }
  }

  // 3. 評分：與評分區間位元圖的交集
  if (f.rating !== undefined) {
    const [from, to] =
      f.ratingOp === "gte" ? [f.rating, 5] : f.ratingOp === "lte" ? [0, f.rating] : [f.rating, f.rating];
    result.andInPlace(db.facets.ratingRange(from, to));
  }

  // 4. 名稱子字串：位元圖無法表達，迭代候選後置過濾並收斂回位元圖
  if (f.search) {
    const matched = new BitSet();
    for (const ordinal of result.values()) {
      const id = db.ordinals.idOf(ordinal);
      if (id === null) continue;
      const name = (db.data.images[id].name ?? "").toLowerCase();
      if (name.includes(f.search)) matched.set(ordinal);
    }
    result = matched;
  }

  return result;
}

/**
 * 對「篩選後、遮蔽前」的集合計算全部標籤的 facet 計數。
 *
 * 一般標籤：count = |visible ∩ tagBits[t]|。
 * hidden 且 ∉ Q 的標籤 t：把 t 加入篩選會同時把 t 從遮罩中移除，
 * 因此以「遮罩排除 t 自身」的集合重算。
 */
function computeFacets(db: Database, preHidden: BitSet, visible: BitSet, included: ReadonlySet<string>): TagFacet[] {
  const hiddenSet = new Set(db.hiddenTagNames());
  const facets: TagFacet[] = [];

  for (const [name, bits] of db.facets.tagBits) {
    const isHidden = hiddenSet.has(name);
    let count: number;

    if (isHidden && !included.has(name)) {
      const excludeSelf = new Set(included);
      excludeSelf.add(name);
      const mask = hiddenMask(db, excludeSelf);
      const base = mask ? preHidden.clone().andNotInPlace(mask) : preHidden;
      count = base.andSize(bits);
    } else {
      count = visible.andSize(bits);
    }

    if (count > 0) {
      facets.push({ name, count, hidden: isHidden });
    }
  }

  facets.sort((a, b) => b.count - a.count || sortCollator.compare(a.name, b.name));
  return facets;
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

/**
 * 將位元圖物化為帶 id 的圖片紀錄陣列。
 */
function materialize(db: Database, bits: BitSet): ImageWithId[] {
  const items: ImageWithId[] = [];
  for (const ordinal of bits.values()) {
    const id = db.ordinals.idOf(ordinal);
    if (id === null) continue;
    items.push({ id, ...db.data.images[id] });
  }
  return items;
}

// ---

/**
 * 統一圖片查詢：篩選 + hidden 遮蔽 + 排序 + 分頁 + facet 計數。
 * `limit > 0` 時分頁；`limit` 為 0 或省略時回傳全部。
 */
export function queryImages(db: Database, opts: QueryOptions = {}): QueryResult {
  const search = opts.search?.trim().toLowerCase() ?? "";
  const includedTags = opts.includedTags ?? [];
  const excludedTags = opts.excludedTags ?? [];
  const rating = opts.rating;
  const ratingOp = opts.ratingOp ?? "gte";
  const sort = opts.sort ?? "rating";
  const order = opts.order ?? "desc";
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;
  const page = Math.max(1, opts.page ?? 1);

  const included = new Set(includedTags);
  const preHidden = filterBitmapBeforeHidden(db, { search, includedTags, excludedTags, rating, ratingOp });

  const mask = hiddenMask(db, included);
  const visible = mask ? preHidden.clone().andNotInPlace(mask) : preHidden;

  const facets = computeFacets(db, preHidden, visible, included);

  let items = sortImages(materialize(db, visible), sort, order);
  const total = items.length;

  if (limit > 0) {
    const pages = Math.max(1, Math.ceil(total / limit));
    const clampedPage = Math.min(page, pages);
    const start = (clampedPage - 1) * limit;
    items = items.slice(start, start + limit);
    return { items, total, page: clampedPage, pages, facets };
  }

  return { items, total, page: 1, pages: 1, facets };
}

// ---

interface TagSummary {
  name: string;
  count: number;
  hidden: boolean;
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

function toSample(db: Database, id: string): TagImageSample | null {
  const record = db.data.images[id];
  if (!record) return null;

  return { id, name: record.name, width: record.width, height: record.height, blurhash: record.blurhash };
}

function sampleImageIds(db: Database, tagName: string, ids: string[], limit: number, mode: TagSampleMode): string[] {
  if (limit <= 0 || ids.length === 0) return [];

  const newIds = ids.filter((id) => id in db.data.images);

  if (mode === "random") {
    shuffle(newIds);
  } else if (mode === "recent") {
    newIds.sort((a, b) => {
      const result = sortCollator.compare(String(db.data.images[b].committedAt), String(db.data.images[a].committedAt));
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

function withSamples(db: Database, tag: TagSummary, sampleLimit: number, sampleMode: TagSampleMode): TagWithSamples {
  const samples = sampleImageIds(db, tag.name, tag.ids, sampleLimit, sampleMode)
    .map((id) => toSample(db, id))
    .filter((sample): sample is TagImageSample => sample !== null);

  return { name: tag.name, count: tag.count, hidden: tag.hidden, lastUsedAt: tag.lastUsedAt, samples };
}

/**
 * 計算單一標籤的可見圖片集合：tagBits[t] ∩ live ∖ hidden遮罩(排除 t 自身)。
 * 保證「標籤卡片上的數字 = 帶該標籤查詢後的張數」。
 */
function visibleIdsOfTag(db: Database, name: string): string[] {
  const bits = db.facets.getTagBits(name);
  if (!bits) return [];

  const visible = bits.clone().andInPlace(db.ordinals.live);
  const mask = hiddenMask(db, new Set([name]));
  if (mask) visible.andNotInPlace(mask);

  const ids: string[] = [];
  for (const ordinal of visible.values()) {
    const id = db.ordinals.idOf(ordinal);
    if (id !== null) ids.push(id);
  }
  return ids;
}

/**
 * 統一標籤查詢：篩選 + 排序 + 分頁 + 樣本圖片。
 * `limit > 0` 時分頁；`limit` 為 0 或省略時回傳全部。
 */
export function queryTags(db: Database, opts: TagQueryOptions = {}): TagQueryResult {
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

  const hiddenSet = new Set(db.hiddenTagNames());
  let summaries: TagSummary[] = [];

  for (const name of db.facets.tagBits.keys()) {
    if (search && !name.toLowerCase().includes(search)) continue;

    const ids = visibleIdsOfTag(db, name);
    const count = ids.length;
    if (count === 0) continue;

    if (minCount !== undefined && count < minCount) continue;
    if (maxCount !== undefined && count > maxCount) continue;

    let lastUsedAt = 0;
    for (const id of ids) {
      const committedAt = db.data.images[id]?.committedAt ?? 0;
      if (committedAt > lastUsedAt) lastUsedAt = committedAt;
    }

    summaries.push({ name, count, hidden: hiddenSet.has(name), lastUsedAt, ids });
  }

  summaries = sortTags(summaries, sort, order);

  const total = summaries.length;

  if (limit > 0) {
    const pages = Math.max(1, Math.ceil(total / limit));
    const clampedPage = Math.min(page, pages);
    const start = (clampedPage - 1) * limit;
    const items = summaries.slice(start, start + limit).map((tag) => withSamples(db, tag, sampleLimit, sampleMode));
    return { items, total, page: clampedPage, pages };
  }

  const items = summaries.map((tag) => withSamples(db, tag, sampleLimit, sampleMode));
  return { items, total, page: 1, pages: 1 };
}

/**
 * 全庫（不帶任何篩選）的標籤 facet 計數。
 * 供無查詢語境的頁面（tagger、settings）的自動完成使用。
 */
export function getAllTagFacets(db: Database): TagFacet[] {
  const live = db.ordinals.live;
  const empty = new Set<string>();
  const mask = hiddenMask(db, empty);
  const visible = mask ? live.clone().andNotInPlace(mask) : live;

  return computeFacets(db, live, visible, empty);
}
