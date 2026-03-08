/**
 * 判斷指定元素是否為可編輯的輸入元素（input、textarea 或 contentEditable）。
 * 常用於鍵盤事件處理中，避免在使用者正在輸入時攔截按鍵。
 */
export function isInEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.contentEditable === "true";
}

/**
 * 將指定索引的項目捲動至可視範圍內。
 * 若該項目已在可視區域內，則不做任何操作。
 */
export function scrollToActive(listEl: HTMLElement | null, idx: number, itemH: number): void {
  if (!listEl) return;
  const top = idx * itemH;
  const bottom = top + itemH;
  const viewH = listEl.clientHeight;
  if (top < listEl.scrollTop) {
    listEl.scrollTop = top;
  } else if (bottom > listEl.scrollTop + viewH) {
    listEl.scrollTop = bottom - viewH;
  }
}
