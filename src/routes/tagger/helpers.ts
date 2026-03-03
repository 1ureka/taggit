/**
 * @file helpers.ts
 *
 * Pure utility functions shared by actions and components.
 * No state, no side-effects — just computation.
 */

/** Build the URL for a staged image by filename. */
export function stagedUrl(name: string): string {
  return `/img/staged/${encodeURIComponent(name)}`;
}

/** Measure the natural dimensions of an image URL. */
export function imageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

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
