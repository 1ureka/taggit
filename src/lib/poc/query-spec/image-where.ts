/**
 * @file image-where.ts
 * 圖片篩選值物件
 */

import { parseTags, safeInt, parseEnum, buildSearchParams } from "./search-params";

/** {@link ImageWhere} 的資料欄位 (去掉方法) */
export type ImageWhereFields = {
  search: string;
  includedTags: string[];
  excludedTags: string[];
  rating?: number;
  ratingOp: "gte" | "lte" | "eq";
};

export class ImageWhere {
  /** 本值物件在 URL 上擁有的可能出現的查詢鍵 */
  static readonly KEYS = ["search", "includedTags", "excludedTags", "rating", "ratingOp"] as const;

  /** 圖片名稱子字串搜尋。 */
  search: string;
  /** 必須同時包含的標籤（AND）。 */
  includedTags: string[];
  /** 必須排除的標籤（NOT）。 */
  excludedTags: string[];
  /** 評分門檻或精確值。 */
  rating?: number;
  /** 評分比較運算子。 */
  ratingOp: "gte" | "lte" | "eq";

  constructor(init: Partial<ImageWhereFields> = {}) {
    this.search = init.search ?? "";
    this.includedTags = init.includedTags ?? [];
    this.excludedTags = init.excludedTags ?? [];
    this.rating = init.rating;
    this.ratingOp = init.ratingOp ?? "gte";
  }

  /** 目前欄位快照（純資料）。 */
  fields(): ImageWhereFields {
    return {
      search: this.search,
      includedTags: this.includedTags,
      excludedTags: this.excludedTags,
      rating: this.rating,
      ratingOp: this.ratingOp,
    };
  }

  /** 複製當前條件並覆寫部分欄位，回傳一個全新的值物件 */
  with(patch: Partial<ImageWhereFields>): ImageWhere {
    return new ImageWhere({ ...this.fields(), ...patch });
  }

  /** 從 URL 查詢參數（URLSearchParams）解析並建立值物件 */
  static fromSearchParams(params: URLSearchParams): ImageWhere {
    return new ImageWhere({
      search: params.get("search") ?? undefined,
      includedTags: parseTags(params.get("includedTags")),
      excludedTags: parseTags(params.get("excludedTags")),
      rating: safeInt(params.get("rating")),
      ratingOp: parseEnum(params.get("ratingOp"), ["gte", "lte", "eq"]),
    });
  }

  /**
   * 將當前篩選條件轉換為 URL 查詢參數 (自動忽略預設值以精簡網址)，可透過傳入 `base` 保留頁面其他的查詢參數
   */
  toSearchParams(base?: URLSearchParams): URLSearchParams {
    const p = buildSearchParams(base, ImageWhere.KEYS);
    if (this.search.trim()) p.set("search", this.search.trim());
    if (this.includedTags.length > 0) p.set("includedTags", this.includedTags.join(","));
    if (this.excludedTags.length > 0) p.set("excludedTags", this.excludedTags.join(","));
    if (this.rating !== undefined) p.set("rating", String(this.rating));
    if (this.ratingOp !== "gte") p.set("ratingOp", this.ratingOp);
    return p;
  }
}
