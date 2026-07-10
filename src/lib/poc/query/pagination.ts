/**
 * @file pagination.ts
 * 通用的分頁純函式
 */

import type { QueryResult } from "./types";

/** `limit <= 0` 代表不分頁，否則限縮頁碼並分頁。 */
export function paginate<T>(items: T[], page: number, limit: number): QueryResult<T> {
  const total = items.length;
  if (limit <= 0) return { items, total, page: 1, pages: 1 };

  const pages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(Math.max(1, page), pages);
  const start = (clampedPage - 1) * limit;
  return { items: items.slice(start, start + limit), total, page: clampedPage, pages };
}
