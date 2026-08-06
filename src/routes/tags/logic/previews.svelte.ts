/**
 * @file previews.svelte.ts
 * 標籤懸停預覽圖的查詢與快取
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { api } from "$lib/utils/request";
import { ImageQuery, ImageWhere, ListOptions, type ImageSort } from "$lib/query-spec";
import type { ImageWithId } from "$lib/database";

import { getPageDataContext } from "./page-data.svelte";

type CacheEntry = "loading" | ImageWithId[];

class PreviewsController {
  private pageData = getPageDataContext();

  private cache = new SvelteMap<string, CacheEntry>();

  constructor() {
    // SSR 資料更新後讓快取失效
    $effect(() => {
      this.pageData.value.items;
      this.cache.clear();
    });
  }

  /** 指定標籤目前的快取狀態；`undefined` = 尚未查詢過 */
  get = (tag: string) => this.cache.get(tag);

  /** 查詢指定標籤的預覽圖（評等最高 N 張）；已有快取或載入中則不重查 */
  request = async (tag: string) => {
    if (this.cache.has(tag)) return;
    this.cache.set(tag, "loading");

    const query = new ImageQuery(
      new ImageWhere({ includedTags: [tag] }),
      new ListOptions<ImageSort>({ sort: "rating", order: "desc", limit: 4 }),
    );

    const res = await api.get<{ items: ImageWithId[]; total: number }>(`/api/records?${query.toSearchParams()}`);

    if (!res.ok) {
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
