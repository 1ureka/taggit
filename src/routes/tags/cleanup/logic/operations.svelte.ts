/**
 * @file operations.svelte.ts
 * 全頁共用的操作鎖，以及重新整理
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { addToast } from "$lib/components/floating/toast-events";
import { getSamplesContext } from "./samples.svelte";

class OperationsController {
  private samples = getSamplesContext();

  /** 全頁共用的操作鎖與指示 */
  pending = $state(false);

  /** 重新整理建議清單 */
  handleRefresh = async () => {
    if (this.pending) return;

    this.pending = true;
    await new Promise((resolve) => setTimeout(resolve, 300)); // debounce

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
      this.samples.clear(); // 標籤內容可能已變，樣本圖快取失效
      addToast({ message: "建議已重新計算", variant: "success" });
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
