/**
 * @file poc/query-spec/index.ts
 * 值物件（isomorphic）的公開入口 —— 唯一前端也會 import 的一層。
 *
 * **豁免「對外只一個 class」規則**:query-spec 天生是多個值物件 class，每個都自我描述
 * （`ImageQuery.fromSearchParams`），不是 `import * as` 後裸呼的模糊 free function。
 *
 * **絕不 import server code**（database / query / mutation）：實體隔離成獨立模組，
 * 把「不能有 query-spec → server 的 edge」從慣例升級成結構強制。
 */

export { ImageWhere, type ImageWhereFields } from "./image-where.js";
export { ListOptions, type ListFields } from "./list-options.js";
export { ImageQuery } from "./image-query.js";
export { TagWhere, type TagWhereFields } from "./tag-where.js";
export { TagQuery } from "./tag-query.js";
export { IMAGE_SORTS, TAG_SORTS, type ImageSort, type TagSort } from "./types.js";
