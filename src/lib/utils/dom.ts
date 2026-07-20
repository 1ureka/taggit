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
