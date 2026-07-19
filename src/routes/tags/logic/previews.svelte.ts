/**
 * @file previews.svelte.ts
 * 標籤懸停預覽圖的查詢與快取，同一次掛載期間同標籤不重查，送出成功後整個清空。
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { api } from "$lib/utils/request";
import { ImageQuery, ImageWhere, ListOptions, type ImageSort } from "$lib/query-spec";
import type { ImageWithId } from "$lib/database";

type CacheEntry = "loading" | ImageWithId[];

class PreviewsController {
  private cache = new SvelteMap<string, CacheEntry>();

  /** 指定標籤目前的快取狀態；`undefined` = 尚未查詢過 */
  get = (tag: string) => this.cache.get(tag);

  /** 清空快取（tags-batch 送出成功後標籤內容已變） */
  clear = () => this.cache.clear();

  /** 查詢指定標籤的預覽圖（評等最高 N 張）；已有快取或載入中則不重查 */
  request = async (tag: string) => {
    if (this.cache.has(tag)) return;
    this.cache.set(tag, "loading");

    const query = new ImageQuery(
      new ImageWhere({ includedTags: [tag] }),
      new ListOptions<ImageSort>({ sort: "rating", order: "desc", limit: 4 }),
    );

    const res = await api.get<{ items: ImageWithId[]; total: number }>(
      `/api/proto/committed-query?${query.toSearchParams()}`,
    );

    if (!res.ok || !res.data) {
      this.cache.delete(tag); // 失敗時移除，下次懸停重試
      return;
    }

    this.cache.set(tag, res.data.items);
  };
}

const key = Symbol("previews-controller");

export const createPreviewsContext = () => {
  const controller = new PreviewsController();
  setContext(key, controller);
  return controller;
};

export const getPreviewsContext = () => getContext<PreviewsController>(key);
