/**
 * @file cache.svelte.ts
 * 縮圖快取管理
 */

import { getContext, setContext } from "svelte";
import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";
import { getPageDataContext } from "./page-data.svelte";

class CacheController {
  private pageData = getPageDataContext();

  /** 快取總項目數 */
  entries = $derived(this.pageData.value.cacheStats.entries);
  /** 快取總大小 */
  bytes = $derived(this.pageData.value.cacheStats.bytes);
  /** 是否正在清除快取中 */
  pending = $state(false);

  /** 處理清除快取事件 */
  handleClear = async () => {
    if (this.pending) return;
    this.pending = true;

    try {
      const res = await api.del<{ cleared: number }>("/api/cache");

      if (!res.ok) {
        addToast({ message: "清空快取失敗：" + res.error, variant: "error" });
        return;
      }

      this.entries = 0;
      this.bytes = 0;

      addToast({ message: `已清空 ${res.data.cleared} 筆快取`, variant: "success" });
    } catch (err) {
      addToast({ message: "清空快取失敗：" + formatError(err), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("cache-controller");

export const createCacheContext = () => {
  const controller = new CacheController();
  setContext(key, controller);
  return controller;
};

export const getCacheContext = () => getContext<CacheController>(key);
