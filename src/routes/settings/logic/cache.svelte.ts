/**
 * @file cache.svelte.ts
 * 縮圖快取統計 + 清空
 */

import { getContext, setContext } from "svelte";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { getPageDataContext } from "./page-data.svelte";

class CacheController {
  private pageData = getPageDataContext();

  // 可覆寫的 derived，清空快取時覆寫為 0，load 重跑後回到伺服器統計
  entries = $derived(this.pageData.value.cacheStats.entries);
  bytes = $derived(this.pageData.value.cacheStats.bytes);
  busy = $state(false);

  handleClear = async () => {
    if (this.busy) return;
    this.busy = true;

    try {
      const res = await api.del<{ cleared: number }>("/api/settings/cache");
      if (res.ok && res.data) {
        addToast({ message: `已清空 ${res.data.cleared} 筆快取`, variant: "success" });
        this.entries = 0;
        this.bytes = 0;
      } else {
        addToast({ message: `清空快取失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
      }
    } catch (err) {
      addToast({ message: "清空快取失敗" + (err instanceof Error ? `：${err.message}` : ""), variant: "error" });
    } finally {
      this.busy = false;
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
