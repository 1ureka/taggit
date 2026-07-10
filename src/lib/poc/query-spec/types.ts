/**
 * @file types.ts
 * query-spec 共用型別：排序軸與其合法值集（值物件與 query 引擎共用）。
 *
 * QueryResult<T> / Tag 不在這裡（它們是查詢**結果**，屬 query 模組）；
 * query-spec 只描述查詢的**輸入**。
 */

/** 圖片排序軸；`random` 忽略 order。 */
export type ImageSort = "committedAt" | "rating" | "name" | "random";
/** 標籤排序軸。 */
export type TagSort = "name" | "count";

export const IMAGE_SORTS: readonly ImageSort[] = ["committedAt", "rating", "name", "random"];
export const TAG_SORTS: readonly TagSort[] = ["name", "count"];
