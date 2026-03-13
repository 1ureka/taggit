/**
 * HomeCards 的互動邏輯
 */
export class HomeCards {
  /** 處理 Window 滑鼠移動事件，更新背景光暈座標 */
  handleWindowMousemove = (e: MouseEvent) => {
    document.documentElement.style.setProperty("--bg-x", e.clientX + "px");
    document.documentElement.style.setProperty("--bg-y", e.clientY + "px");
  };
}
