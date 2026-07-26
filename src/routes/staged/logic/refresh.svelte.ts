/**
 * @file refresh.svelte.ts
 * 重新整理暫存列表
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { addToast } from "$lib/components/floating/toast-events";

class RefreshController {
  /** 是否有一次重新整理正在進行中 */
  pending = $state(false);

  /** 重新整理，條件不變再次查詢 */
  handleRefresh = async () => {
    if (this.pending) return;

    this.pending = true;
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
      addToast({ message: "暫存列表已更新", variant: "success" });
    } catch (e) {
      addToast({ message: "重新整理失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("refresh-controller");

export const createRefreshContext = () => {
  const controller = new RefreshController();
  setContext(key, controller);
  return controller;
};

export const getRefreshContext = () => getContext<RefreshController>(key);
