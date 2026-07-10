/**
 * @file types.ts
 * 查詢結果實體。
 */

import type { TagMeta } from "$lib/poc/database";

/** 分頁查詢結果。images 與 tags 兩引擎的結果對稱。 */
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

/** 標籤查詢的回傳實體，對標 ImageWithId */
export interface Tag {
  /** 標籤名稱 (唯一識別) */
  name: string;
  /** 命中數；語義依查詢型別而定 (TagFacetQuery=遮蔽後計數 / TagQuery=原始總使用數) */
  count: number;
  /** 標籤自身的元資料 */
  meta: TagMeta;
}
