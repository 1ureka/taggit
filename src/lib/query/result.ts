/**
 * @file result.ts
 * 查詢結果實體。
 */

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
