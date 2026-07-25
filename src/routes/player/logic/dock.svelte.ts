/**
 * @file dock.ts
 * 管理控制列的自動隱藏或顯示，滑鼠移動時顯示，靜止逾時後隱藏
 */

import { getContext, setContext } from "svelte";

class DockController {
  /** 是否隱藏 dock */
  hideDock = $state(false);
  /** 自動隱藏的閾值時間（毫秒） */
  private readonly timeout = 2000;
  /** 自動隱藏計時器 */
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    $effect(() => {
      const handleActivity = () => {
        this.hideDock = false;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => (this.hideDock = true), this.timeout);
      };

      document.addEventListener("mousemove", handleActivity);
      handleActivity();

      return () => {
        clearTimeout(this.timer);
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
