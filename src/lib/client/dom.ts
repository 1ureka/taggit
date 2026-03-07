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
