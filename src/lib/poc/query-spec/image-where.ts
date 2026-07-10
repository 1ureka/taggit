/**
 * @file image-where.ts
 * ImageWhere —— 圖片篩選述詞（isomorphic 值物件）。
 *
 * `ImageQuery.where` 與 `TagQuery.scope` 皆為此型別：faceted 頁 = 同一個 ImageWhere
 * 各建一個 ImageQuery 與 TagQuery，分別執行。預設值於建構時一次確立。
 */

import { parseTags, safeInt, parseEnum } from "./parse.js";

/** {@link ImageWhere} 的資料欄位（去掉方法），用於建構 / with 的 patch 形狀。 */
export type ImageWhereFields = {
  search: string;
  includedTags: string[];
  excludedTags: string[];
  rating?: number;
  ratingOp: "gte" | "lte" | "eq";
};

export class ImageWhere {
  /** 圖片名稱子字串搜尋（大小寫不敏感由引擎處理；此處保留原樣以利 round-trip）。 */
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

  /** 不可變覆寫。 */
  with(patch: Partial<ImageWhereFields>): ImageWhere {
    return new ImageWhere({ ...this.fields(), ...patch });
  }

  static fromSearchParams(params: URLSearchParams): ImageWhere {
    return new ImageWhere({
      search: params.get("search") ?? undefined,
      includedTags: parseTags(params.get("includedTags")),
      excludedTags: parseTags(params.get("excludedTags")),
      rating: safeInt(params.get("rating")),
      ratingOp: parseEnum(params.get("ratingOp"), ["gte", "lte", "eq"]),
    });
  }

  /** 只輸出自己的 key，預設省略（利 round-trip）。 */
  toSearchParams(): URLSearchParams {
    const p = new URLSearchParams();
    if (this.search.trim()) p.set("search", this.search.trim());
    if (this.includedTags.length > 0) p.set("includedTags", this.includedTags.join(","));
    if (this.excludedTags.length > 0) p.set("excludedTags", this.excludedTags.join(","));
    if (this.rating !== undefined) p.set("rating", String(this.rating));
    if (this.ratingOp !== "gte") p.set("ratingOp", this.ratingOp);
    return p;
  }
}
