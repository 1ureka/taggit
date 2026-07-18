/** Inspector 開啟時佔用的寬度，用來推算可用寬度 */
export const INSPECTOR_WIDTH = 352;

/** 依可用寬度找欄數的門檻陣列 */
export const breakpoints = [
  { width: 1600, cols: 6, p: 16, g: 8 },
  { width: 1200, cols: 5, p: 16, g: 8 },
  { width: 900, cols: 4, p: 16, g: 8 },
  { width: 500, cols: 3, p: 12, g: 6 },
  { width: 300, cols: 2, p: 8, g: 6 },
  { width: 0, cols: 1, p: 8, g: 6 },
];

/** 所有卡片統一使用的固定寬高比，只用於 masonry 版面權重計算，與圖片實際比例無關 */
export const CARD_SIZE = { width: 1, height: 1 };
