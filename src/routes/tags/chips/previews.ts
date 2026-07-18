/**
 * @file previews.ts
 * 標籤懸停預覽圖的查詢與快取：hover 去抖後才查（GET /api/proto/committed-query，
 * 評等最高 4 張），同 session 同標籤不重查；送出成功後整個清空（標籤內容已變）。
 */

import { SvelteMap } from "svelte/reactivity";
import { api } from "$lib/utils/request";
import { ImageQuery, ImageWhere, ListOptions, type ImageSort } from "$lib/query-spec";
import type { ImageWithId } from "$lib/database";

type CacheEntry = "loading" | ImageWithId[];

// TODO: 不該這樣寫，太危險
/** 模組層級的響應式快取：tooltip snippet 直接讀，載入完成自動更新畫面 */
export const previewCache = new SvelteMap<string, CacheEntry>();

/** 清空快取（tags-batch 送出成功後標籤內容已變） */
export function clearPreviews(): void {
  previewCache.clear();
}

/** 查詢指定標籤的預覽圖（評等最高 N 張）；已有快取或載入中則不重查 */
export async function requestPreview(tag: string): Promise<void> {
  if (previewCache.has(tag)) return;
  previewCache.set(tag, "loading");

  const query = new ImageQuery(
    new ImageWhere({ includedTags: [tag] }),
    new ListOptions<ImageSort>({ sort: "rating", order: "desc", limit: 4 }),
  );

  const res = await api.get<{ items: ImageWithId[]; total: number }>(
    `/api/proto/committed-query?${query.toSearchParams()}`,
  );

  if (!res.ok || !res.data) {
    previewCache.delete(tag); // 失敗時移除，下次懸停重試
    return;
  }

  previewCache.set(tag, res.data.items);
}
