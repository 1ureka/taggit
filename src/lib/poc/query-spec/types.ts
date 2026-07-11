/**
 * @file types.ts
 * query-spec 共用型別，目前只包含排序軸與其合法值集
 */

/** 圖片排序軸；`random` 忽略 order。 */
export type ImageSort = "committedAt" | "rating" | "name" | "random";
/** 標籤排序軸。 */
export type TagSort = "name" | "count";

export const IMAGE_SORTS: readonly ImageSort[] = ["committedAt", "rating", "name", "random"];
export const TAG_SORTS: readonly TagSort[] = ["name", "count"];
