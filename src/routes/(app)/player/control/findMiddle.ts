export function findClosestToMiddle<T>(arr: T[], testFn: (item: T) => boolean) {
  const n = arr.length;
  if (n === 0) return -1;

  const mid = Math.floor(n / 2);
  let L = mid;
  let R = mid;

  // 從中間向兩側擴散，回傳最靠近中央、滿足條件的索引
  while (L >= 0 || R < n) {
    if (L >= 0 && testFn(arr[L])) return L;
    if (R < n && testFn(arr[R])) return R;
    L--;
    R++;
  }

  return -1;
}
