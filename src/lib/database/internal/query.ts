/**
 * @file query.ts
 * 圖片與標籤的唯讀查詢 —— 以位元圖為基礎的兩大查詢引擎。
 *
 * 每個函式都接受 {@link Database} 作為第一個參數，
 * 不依賴模組層級的 singleton，方便測試與替換。
 *
 * 兩大引擎共用私有原語 {@link resolveScope}：把「圖片篩選條件」解析為位元圖 scope。
 * - {@link queryImages}：materialize 成圖片紀錄。
 * - {@link queryTags}：以相同 scope 逐一計數標籤並附上 meta。
 * 兩者以「相同條件」各自取用，而非互相傳遞結果 —— facet 查詢＝呼叫端同時呼叫兩者。
 *
 * hidden 語義：設 H = hidden 標籤集合、Q = 查詢的 includedTags，
 * 圖片被遮蔽 ⇔ 存在 h ∈ H 使圖片擁有 h 且 h ∉ Q。
 */

import { BitSet } from "./bitmap.js";
import type { Database } from "./store.js";
import type { ImageWithId, QueryOptions, QueryResult, SortField, Tag, TagMeta, TagQueryOptions } from "./types.js";
import { DEFAULT_TAG_META } from "./schema.js";
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
 * 篩選圖片的正規化參數（scope 述詞）。
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
 * 執行管線的第 1–4 步（含 rating 與 search，不含 hidden 遮罩）：
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
 * 兩大引擎共用的私有原語：把篩選條件解析為位元圖 scope。
 * 回傳遮蔽前（`preHidden`）與遮蔽後（`visible`）兩個集合，以及正規化後的 includedTags 集合。
 */
function resolveScope(db: Database, f: FilterParams): { preHidden: BitSet; visible: BitSet; included: Set<string> } {
  const included = new Set(f.includedTags);
  const preHidden = filterBitmapBeforeHidden(db, f);
  const mask = hiddenMask(db, included);
  const visible = mask ? preHidden.clone().andNotInPlace(mask) : preHidden;
  return { preHidden, visible, included };
}

/**
 * 由查詢選項萃取出 scope 述詞（忽略 sort / 分頁等圖片呈現用欄位）。
 */
function toFilterParams(opts: QueryOptions): FilterParams {
  return {
    search: opts.search?.trim().toLowerCase() ?? "",
    includedTags: opts.includedTags ?? [],
    excludedTags: opts.excludedTags ?? [],
    rating: opts.rating,
    ratingOp: opts.ratingOp ?? "gte",
  };
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
 * 圖片查詢引擎：篩選 + hidden 遮蔽 + 排序 + 分頁。
 * `limit > 0` 時分頁；`limit` 為 0 或省略時回傳全部。
 */
export function queryImages(db: Database, opts: QueryOptions = {}): QueryResult {
  const sort = opts.sort ?? "rating";
  const order = opts.order ?? "desc";
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 0;
  const page = Math.max(1, opts.page ?? 1);

  const { visible } = resolveScope(db, toFilterParams(opts));

  let items = sortImages(materialize(db, visible), sort, order);
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

/** 讀取標籤元資料，補齊預設值後回傳。 */
function tagMetaOf(db: Database, name: string): TagMeta {
  return { ...DEFAULT_TAG_META, ...db.data.tags[name] };
}

/**
 * 標籤查詢引擎：以「與 {@link queryImages} 相同的圖片篩選條件」界定 scope，
 * 逐一計數標籤並附上 meta，回傳 {@link Tag}[]（依 count 降冪、name 升冪）。
 *
 * count 與遮蔽語義見 {@link TagQueryOptions}。
 */
export function queryTags(db: Database, conditions: QueryOptions = {}, opts: TagQueryOptions = {}): Tag[] {
  const hiddenMode = opts.hidden ?? "mask";
  const universe = opts.universe ?? "used";

  const { preHidden, visible, included } = resolveScope(db, toFilterParams(conditions));
  const hiddenSet = new Set(db.hiddenTagNames());
  const tags: Tag[] = [];

  for (const [name, bits] of db.facets.tagBits) {
    const isHidden = hiddenSet.has(name);
    let count: number;

    if (hiddenMode === "mask" && isHidden && !included.has(name)) {
      // 把該 hidden 標籤加入篩選後的可見數（篩選 UI 點擊後的預期結果數）
      const excludeSelf = new Set(included);
      excludeSelf.add(name);
      const mask = hiddenMask(db, excludeSelf);
      const base = mask ? preHidden.clone().andNotInPlace(mask) : preHidden;
      count = base.andSize(bits);
    } else if (hiddenMode === "mask") {
      count = visible.andSize(bits);
    } else {
      count = preHidden.andSize(bits);
    }

    if (count > 0) tags.push({ name, count, meta: tagMetaOf(db, name) });
  }

  // universe="all"：併入僅有元資料、未被任何圖片使用的標籤（count 0）
  if (universe === "all") {
    for (const name of Object.keys(db.data.tags)) {
      if (db.facets.getTagBits(name)) continue;
      tags.push({ name, count: 0, meta: tagMetaOf(db, name) });
    }
  }

  tags.sort((a, b) => b.count - a.count || sortCollator.compare(a.name, b.name));
  return tags;
}
