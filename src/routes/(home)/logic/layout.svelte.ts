/**
 * @file layout.ts
 * 管理圖片牆的斷點布局，以及使用者可覆寫的欄數
 */

import { getContext, setContext } from "svelte";
import { innerWidth } from "svelte/reactivity/window";

const BREAKPOINTS = [
  { width: 1600, cols: 5, p: 24, g: 6 },
  { width: 1200, cols: 4, p: 24, g: 6 },
  { width: 900, cols: 3, p: 24, g: 6 },
  { width: 600, cols: 2, p: 12, g: 6 },
  { width: 0, cols: 2, p: 6, g: 4 },
];

class LayoutController {
  private breakpoint = $derived.by(() => {
    const width = innerWidth.current ?? 1000;
    return BREAKPOINTS.find((b) => width >= b.width)!;
  });

  /** 圖片牆欄數；使用者可透過 handleColumnsChange 覆寫，跨越斷點時會回到該斷點的預設值 */
  columns = $derived(this.breakpoint.cols);
  /** 兩側／上下留白 */
  padding = $derived(this.breakpoint.p);
  /** 項目間距 */
  gap = $derived(this.breakpoint.g);

  /** 處理使用者手動選擇欄數 */
  handleColumnsChange = (n: number) => {
    this.columns = n;
  };
}

const key = Symbol("layout-controller");

export const createLayoutContext = () => {
  const controller = new LayoutController();
  setContext(key, controller);
  return controller;
};

export const getLayoutContext = () => getContext<LayoutController>(key);
