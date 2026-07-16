/**
 * @file pool.ts
 * 標籤池的伺服器分頁查詢（GET /api/proto/tags-query，standalone 語意：
 * count 為原始總使用數、不經 hidden 遮蔽、universe=all 含 count 0 標籤）。
 */

import { api } from "$lib/utils/request";
import { TagQuery, TagWhere, ListOptions, type TagSort } from "$lib/query-spec";
import type { Tag } from "$lib/database";

export const PAGE_SIZE = 100;

/** 池的查詢條件（分頁狀態純前端，不進 URL） */
export type PoolQuery = {
  /** 名稱子字串搜尋 */
  search: string;
  /** 排序：使用數降冪 / 名稱升冪 */
  sort: "count" | "name";
  /** 顯隱篩選 */
  hidden: "all" | "hidden" | "visible";
  /** 頁碼（從 1 起） */
  page: number;
};

/** 組出池查詢的 URL 參數 */
export function buildPoolParams(q: PoolQuery): URLSearchParams {
  const where = new TagWhere({
    name: q.search.trim() || undefined,
    hidden: q.hidden === "all" ? undefined : q.hidden === "hidden",
    universe: "all",
  });
  const list = new ListOptions<TagSort>({
    sort: q.sort,
    order: q.sort === "count" ? "desc" : "asc",
    page: q.page,
    limit: PAGE_SIZE,
  });
  return new TagQuery(where, list).toSearchParams();
}

/** 查詢一頁標籤。傳輸層錯誤直接 throw。 */
export async function fetchPool(q: PoolQuery): Promise<{ items: Tag[]; total: number }> {
  const res = await api.get<{ items: Tag[]; total: number }>(`/api/proto/tags-query?${buildPoolParams(q)}`);
  if (!res.ok || !res.data) throw new Error(res.error || "查詢標籤失敗");
  return res.data;
}
