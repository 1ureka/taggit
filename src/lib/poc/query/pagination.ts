/**
 * @file pagination.ts
 * 通用分頁（純函式 util，非 class；兩引擎共用）。
 */

import type { QueryResult } from "./types.js";

/** `limit <= 0` 回全部（page 1 / pages 1）；否則夾住頁碼並切片。 */
export function paginate<T>(items: T[], page: number, limit: number): QueryResult<T> {
  const total = items.length;
  if (limit <= 0) return { items, total, page: 1, pages: 1 };

  const pages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(Math.max(1, page), pages);
  const start = (clampedPage - 1) * limit;
  return { items: items.slice(start, start + limit), total, page: clampedPage, pages };
}
