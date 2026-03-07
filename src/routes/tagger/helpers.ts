/**
 * Process `items` through `fn` in fixed-size concurrent batches.
 * Returns `[successCount, failCount]`.
 */
export async function batchRun<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<{ ok: boolean }>,
): Promise<[ok: number, fail: number]> {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.all(items.slice(i, i + size).map(fn));
    for (const r of results) r.ok ? ok++ : fail++;
  }
  return [ok, fail];
}

/** 將指定索引的項目捲動至可視範圍內 */
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
