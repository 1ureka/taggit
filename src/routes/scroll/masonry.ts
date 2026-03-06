/**
 * @file 瀑布流佈局計算
 * @description 純函式模組，負責權重式多欄佈局分配與視窗虛擬化裁切
 */

// ─── Types ──────────────────────────────────────────────────────────────

/** 帶有寬高屬性的基本物件介面 */
type ItemWithSize = { width: number; height: number };

/** 單個項目在軌道中的垂直位置資訊 */
export interface TrackItem<T> {
  item: T;
  /** 權重座標起點 */
  yStart: number;
  /** 權重座標終點 */
  yEnd: number;
}

/** 多軌道佈局：第一層為欄位（軌道），第二層為該軌道內的有序項目 */
export type Tracks<T> = TrackItem<T>[][];

/** 完整軌道分配結果 */
export interface Layout<T> {
  tracks: Tracks<T>;
  /** 所有軌道中的最大權重高度 */
  yMax: number;
}

/** 帶有最終渲染像素座標的項目 */
export type VirtualizedItem<T> = T & {
  pixelX: number;
  pixelY: number;
  pixelW: number;
  pixelH: number;
};

// ─── Layout ─────────────────────────────────────────────────────────────

/**
 * 貪婪權重式多欄佈局
 *
 * 將每個項目的「權重高度」定義為 `height / width`（假設欄寬為單位 1），
 * 每次將項目放入目前最短的欄位，實現高度平衡的瀑布流分配。
 */
export function createWeightBasedLayout<T extends ItemWithSize>(items: T[], columns: number): Layout<T> {
  const cols = Math.max(1, columns);

  if (items.length === 0) {
    return { tracks: Array.from({ length: cols }, () => []), yMax: 0 };
  }

  const columnHeights = new Float64Array(cols); // 初始化為 0
  const tracks: Tracks<T> = Array.from({ length: cols }, () => []);
  let yMax = 0;

  for (const item of items) {
    // 權重高度：h / w（寬為 0 則視為 1:1）
    const heightRatio = item.width > 0 ? item.height / item.width : 1;

    // 找到目前最短的軌道
    let minIdx = 0;
    for (let i = 1; i < cols; i++) {
      if (columnHeights[i] < columnHeights[minIdx]) minIdx = i;
    }

    const yStart = columnHeights[minIdx];
    const yEnd = yStart + heightRatio;

    tracks[minIdx].push({ item, yStart, yEnd });
    columnHeights[minIdx] = yEnd;
    if (yEnd > yMax) yMax = yEnd;
  }

  return { tracks, yMax };
}

// ─── Virtualization ─────────────────────────────────────────────────────

/**
 * 基於二分搜尋的視窗虛擬化
 *
 * 適用於任意 scroll 容器：由呼叫端計算可見區域在容器內的本地座標，
 * 並從各軌道中以二分搜尋高效篩選出可見項目。
 */
export function getVirtualizedItems<T extends ItemWithSize>(params: {
  tracks: Tracks<T>;
  yMax: number;
  /** 容器實際可用寬度（不含捲軸） */
  containerWidth: number;
  /** 可見區域上緣，相對於容器頂端的像素偏移（>= 0） */
  localTop: number;
  /** 可見區域下緣，相對於容器頂端的像素偏移 */
  localBottom: number;
}): { visibleItems: VirtualizedItem<T>[]; totalHeight: number } {
  const { tracks, yMax, containerWidth, localTop, localBottom } = params;

  if (tracks.length === 0 || yMax <= 0 || containerWidth <= 0) {
    return { visibleItems: [], totalHeight: 0 };
  }

  const k = containerWidth / tracks.length; // 權重單位 → 像素 的係數
  const totalHeight = yMax * k;

  if (localBottom <= 0 || localTop >= totalHeight) {
    return { visibleItems: [], totalHeight };
  }

  const vStart = localTop / k;
  const vEnd = localBottom / k;

  const visibleItems: VirtualizedItem<T>[] = [];

  for (let colIndex = 0; colIndex < tracks.length; colIndex++) {
    const track = tracks[colIndex];
    if (track.length === 0) continue;

    // 二分搜尋：找到第一個 yEnd > vStart 的項目
    let low = 0;
    let high = track.length - 1;
    let firstIdx = -1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (track[mid].yEnd > vStart) {
        firstIdx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    if (firstIdx < 0) continue;

    // 從第一個可見項目向後遍歷，直到 yStart 越過視窗底端
    for (let i = firstIdx; i < track.length; i++) {
      const { item, yStart, yEnd } = track[i];
      if (yStart > vEnd) break;

      visibleItems.push({
        ...item,
        pixelX: colIndex * k,
        pixelY: yStart * k,
        pixelW: k,
        pixelH: (yEnd - yStart) * k,
      });
    }
  }

  return { visibleItems, totalHeight };
}
