/**
 * @file dom.ts
 * 前端 DOM 工具函式
 */

/**
 * 判斷指定元素是否為可編輯的輸入元素（input、textarea 或 contentEditable）。
 * 常用於鍵盤事件處理中，避免在使用者正在輸入時攔截按鍵。
 */
export function isInEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.contentEditable === "true";
}

/**
 * 判斷一次 `dragleave`／`mouseleave` 是不是只冒泡到子元素，而非真的離開目前元素。
 * 游標移到區塊內的按鈕或輸入框時 `relatedTarget` 仍在區塊內，據此可避免懸停樣式閃爍。
 */
export function isLeavingSelf(e: { relatedTarget: EventTarget | null; currentTarget: EventTarget | null }): boolean {
  const { relatedTarget: related, currentTarget: current } = e;
  if (related instanceof Node && current instanceof HTMLElement && current.contains(related)) return false;
  return true;
}
