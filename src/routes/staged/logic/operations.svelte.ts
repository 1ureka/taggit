/**
 * @file operations.svelte.ts
 * 全頁共用的操作鎖，以及重新整理暫存列表
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { addToast } from "$lib/components/floating/toast-events";

class OperationsController {
  /** 全頁共用的操作鎖與指示 */
  pending = $state(false);

  /** 重新整理暫存列表 */
  handleRefresh = async () => {
    if (this.pending) return;

    this.pending = true;
    await new Promise((resolve) => setTimeout(resolve, 200)); // debounce

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

const key = Symbol("operations-controller");

export const createOperationsContext = () => {
  const controller = new OperationsController();
  setContext(key, controller);
  return controller;
};

export const getOperationsContext = () => getContext<OperationsController>(key);
