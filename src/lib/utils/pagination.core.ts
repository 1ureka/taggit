/**
 * @file pagination.core.ts
 * 分頁的結果型別與純函式
 */

/** 一頁的內容，以及它在整份清單裡的位置。 */
export interface Paginated<T> {
  /** 當前頁的項目清單。 */
  items: T[];
  /** 分頁前的項目總數。 */
  total: number;
  /** 當前頁碼。 */
  page: number;
  /** 總頁數。 */
  pages: number;
}

/** `limit <= 0` 代表不分頁，否則限縮頁碼並分頁。 */
export function paginate<T>(items: T[], page: number, limit: number): Paginated<T> {
  const total = items.length;
  if (limit <= 0) return { items, total, page: 1, pages: 1 };

  const pages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(Math.max(1, page), pages);
  const start = (clampedPage - 1) * limit;
  return { items: items.slice(start, start + limit), total, page: clampedPage, pages };
}
