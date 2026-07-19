/**
 * @file dock.ts
 * 管理控制列的自動隱藏或顯示，滑鼠移動時顯示，靜止逾時後隱藏
 */

import { getContext, setContext } from "svelte";
import { debounce } from "$lib/utils/shared";

class DockController {
  /** 是否隱藏 dock */
  hideDock = $state(false);
  /** 自動隱藏的閾值時間（毫秒） */
  private readonly timeout = 2000;

  constructor() {
    $effect(() => {
      const hide = debounce(() => (this.hideDock = true), this.timeout);

      const handleActivity = () => {
        this.hideDock = false;
        hide();
      };

      document.addEventListener("mousemove", handleActivity);
      handleActivity();

      return () => {
        document.removeEventListener("mousemove", handleActivity);
      };
    });
  }
}

const key = Symbol("dock-controller");

export const createDockContext = () => {
  const controller = new DockController();
  setContext(key, controller);
  return controller;
};

export const getDockContext = () => getContext<DockController>(key);
