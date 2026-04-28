/**
 * @file cache.ts
 * Stale-While-Revalidate (SWR) 快取機制，用於前端標籤列表等資料的快取與重新驗證。
 */

import { addToast } from "$lib/client/dom.js";
import type { TagInfo, TagQueryResult } from "$lib/types.js";
import { api } from "./api.js";

/** A function that returns a promise of type `T`. */
type AsyncFn<T> = () => Promise<T>;

/**
 * Returns a stale-while-revalidate (SWR) cached version of `fn`.
 * If cached data exists, it is returned immediately even when expired;
 * a background revalidation is triggered when the TTL has elapsed.
 */
function createSWR<T>(fn: AsyncFn<T>, ttl: number, errMsg: string) {
  let cachedData: T | null = null;
  let lastFetchedAt = 0;
  let pendingPromise: Promise<T> | null = null;

  const revalidate = (): Promise<T> => {
    if (pendingPromise) return pendingPromise;

    pendingPromise = fn()
      .then((data) => {
        cachedData = data;
        lastFetchedAt = Date.now();
        return data;
      })
      .finally(() => {
        pendingPromise = null;
      });

    return pendingPromise;
  };

  const get = async (): Promise<T> => {
    const now = Date.now();
    const isExpired = now - lastFetchedAt > ttl;

    if (cachedData === null) {
      return revalidate();
    }

    if (isExpired) {
      revalidate().catch(() => addToast(errMsg, "error"));
    }

    return cachedData;
  };

  const invalidate = () => {
    lastFetchedAt = 0;
    cachedData = null;
    pendingPromise = null;
  };

  return { get, invalidate, revalidate };
}

/**
 * Fetches the list of tags from the server.
 */
const fetchTags = async () => {
  const res = await api.get<TagQueryResult & { tags?: TagInfo[] }>("/api/tags?sampleLimit=0");
  if (!res.ok || !res.data) return [];
  return res.data.tags ?? res.data.items.map(({ name, count }) => ({ name, count }));
};

/**
 * A cached version of `fetchTags` with a TTL of 5 seconds.
 */
export const tagCache = createSWR(fetchTags, 5_000, "獲取標籤失敗");
