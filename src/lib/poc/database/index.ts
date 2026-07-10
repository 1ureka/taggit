/**
 * @file poc/database/index.ts
 * database 引擎的公開入口 —— 只匯出 `Database` class、投影型別 `BitSet`、核心實體型別。
 *
 * 模組外一律只從此檔 import；子檔（store / bitmap / ordinal / facet-index /
 * serialization / types）不對模組外露出。
 *
 * `BitSet` 併此匯出:它是投影原語（tagBits / ratingRange / live）的回傳型別、
 * 也是 query 組合 scope 時的共用詞彙 → 屬 database 的公開契約，非內部細節。
 */

export { Database } from "./store.js";
export { BitSet } from "./bitmap.js";
export type { DBData, ImageRecord, ImageWithId, TagMeta } from "./types.js";
