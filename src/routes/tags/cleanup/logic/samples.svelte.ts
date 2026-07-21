/**
 * @file samples.svelte.ts
 * 建議卡片的證據縮圖：懶加載並以 suggestion id 為鍵快取，卡片因虛擬化捲出/捲回可視範圍時不重查。
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { api } from "$lib/utils/request";
import { ImageQuery, ImageWhere, ListOptions, type ImageSort } from "$lib/query-spec";
import type { ImageWithId } from "$lib/database";
import type { Suggestion } from "./suggestions";

type CacheEntry = "loading" | ImageWithId[];

const SAMPLE_LIMIT = 3;

/** 這則建議涉及的標籤名稱，決定要查哪些標籤的樣本圖 */
function tagsOf(s: Suggestion): string[] {
  switch (s.kind) {
    case "similar":
    case "cooccur":
      return [s.a.name, s.b.name];
    case "rare":
      return [s.tag.name];
    case "unused":
      return [];
  }
}

/** 查詢包含指定（全部）標籤的圖片樣本；傳輸層失敗回傳 `null`，讓呼叫端決定是否重試 */
async function fetchByTags(tags: string[], limit: number): Promise<ImageWithId[] | null> {
  const query = new ImageQuery(
    new ImageWhere({ includedTags: tags }),
    new ListOptions<ImageSort>({ sort: "rating", order: "desc", limit }),
  );
  const res = await api.get<{ items: ImageWithId[]; total: number }>(
    `/api/proto/committed-query?${query.toSearchParams()}`,
  );
  return res.ok && res.data ? res.data.items : null;
}

class SamplesController {
  private cache = new SvelteMap<string, CacheEntry>();

  /** 指定建議目前的快取狀態；`undefined` = 尚未查詢過 */
  get = (id: string) => this.cache.get(id);

  /** 清空快取（tags-batch 送出成功後標籤內容已變） */
  clear = () => this.cache.clear();

  /** 查詢指定建議的樣本圖；已有快取或載入中則不重查 */
  request = async (s: Suggestion) => {
    if (this.cache.has(s.id)) return;

    const tags = tagsOf(s);
    if (tags.length === 0) {
      this.cache.set(s.id, []); // unused：count 恆為 0，必定沒有樣本圖，不必查詢
      return;
    }

    this.cache.set(s.id, "loading");

    const primary = await fetchByTags(tags, SAMPLE_LIMIT);
    if (primary === null) {
      this.cache.delete(s.id); // 失敗時移除，下次進可視範圍重試
      return;
    }
    if (primary.length > 0 || tags.length === 1) {
      this.cache.set(s.id, primary);
      return;
    }

    // 兩個標籤查無交集：退而各自取樣本拼在一起
    const [a, b] = tags;
    const [as, bs] = await Promise.all([fetchByTags([a], SAMPLE_LIMIT), fetchByTags([b], SAMPLE_LIMIT)]);
    if (as === null || bs === null) {
      this.cache.delete(s.id);
      return;
    }
    this.cache.set(s.id, [...as, ...bs].slice(0, SAMPLE_LIMIT));
  };
}

const key = Symbol("samples-controller");

export const createSamplesContext = () => {
  const controller = new SamplesController();
  setContext(key, controller);
  return controller;
};

export const getSamplesContext = () => getContext<SamplesController>(key);
