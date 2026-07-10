/**
 * @file types.ts
 * query 模組的公開結果實體。
 */

import type { TagMeta } from "../database/index.js";

/** 分頁查詢結果。images 與 tags 兩引擎的結果對稱（皆 {@link QueryResult}）。 */
export interface QueryResult<T> {
  /** 當前頁的項目清單。 */
  items: T[];
  /** 符合條件的總筆數（分頁前）。 */
  total: number;
  /** 當前頁碼。 */
  page: number;
  /** 總頁數。 */
  pages: number;
}

/** 標籤查詢的回傳實體，對標 ImageWithId：name 身份、count 查詢衍生、meta 補齊預設。 */
export interface Tag {
  /** 標籤名稱（唯一識別）。 */
  name: string;
  /** 命中數；語義依 TagQuery.scope present/absent 而定。 */
  count: number;
  /** 標籤自身的元資料（已補齊預設）。 */
  meta: TagMeta;
}
