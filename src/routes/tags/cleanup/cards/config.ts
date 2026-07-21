/** 依可用寬度找欄數的門檻陣列 */
export const breakpoints = [
  { width: 1400, cols: 4, p: 16, g: 12 },
  { width: 1000, cols: 3, p: 16, g: 10 },
  { width: 650, cols: 2, p: 12, g: 8 },
  { width: 0, cols: 1, p: 8, g: 8 },
];

/** 所有卡片統一使用的固定寬高比 1.6/1，只用於 masonry 版面權重計算 */
export const CARD_SIZE = { width: 1.5, height: 1 };
