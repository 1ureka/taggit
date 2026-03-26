/**
 * 帶有寬高屬性的基本物件介面
 */
type ItemWithSize = { width: number; height: number };

/**
 * 單個項目在軌道中的垂直權重位置資訊
 */
interface MasonryTrackItem<T> {
  /** 原始的項目 */
  item: T;
  /** 權重座標起點 */
  yStart: number;
  /** 權重座標終點 */
  yEnd: number;
}

/**
 * 軌道，包含多個有序項目與項目的垂直權重位置資訊 (`[item_index]`)
 */
type MasonryTrack<T> = MasonryTrackItem<T>[];

/**
 * 多個軌道，第一層為欄位，第二層為軌道 (`[column][item_index]`)
 */
type MasonryTracks<T> = MasonryTrack<T>[];

/**
 * 以權重為基礎的瀑布流佈局結果
 */
interface MasonryLayout<T> {
  /** 多個軌道，第一層為欄位，第二層為軌道 (`[column][item_index]`) */
  tracks: MasonryTracks<T>;
  /** 所有軌道中的最大權重高度 */
  yMax: number;
}

/**
 * 帶有最終渲染像素座標的虛擬化項目
 */
type MasonryItem<T> = T & {
  pixelX: number;
  pixelY: number;
  pixelW: number;
  pixelH: number;
  style: string;
};

export type { MasonryLayout, MasonryItem };

// ---

/**
 * 貪婪權重式瀑布流佈局
 * @param items 項目陣列，每個項目需包含寬高屬性
 * @param columns 欄位數量
 * @returns 瀑布流佈局結果
 */
export function createMasonryLayout<T extends ItemWithSize>(items: T[], columns: number): MasonryLayout<T> {
  columns = Math.max(1, columns);

  if (items.length === 0) {
    return { tracks: Array.from({ length: columns }, () => []), yMax: 0 };
  }

  const columnHeights = new Float64Array(columns); // 初始化為 0
  const tracks: MasonryTracks<T> = Array.from({ length: columns }, () => []);
  let yMax = 0;

  for (const item of items) {
    // 權重高度：h / w（寬為 0 則視為 1:1）
    const heightRatio = item.width > 0 ? item.height / item.width : 1;

    // 找到目前最短的軌道
    let minIdx = 0;
    for (let i = 1; i < columns; i++) {
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

// ---

/**
 * 基於瀑布流布局的二分搜尋虛擬化項目計算器
 *
 * - viewportEl 只能包含 masonryEl (包含所有 visibleItems 的容器) 作為直接子元素
 * - viewportEl 與 masonryEl  不得包含 padding, border 等 CSS 屬性
 */
export function createMasonryItems<T extends ItemWithSize>(params: {
  /** 以權重為基礎的瀑布流佈局結果 */
  layout: MasonryLayout<T>;
  /** 滾動容器的 DOM 元素，必須包含 masonryEl 作為直接子元素 */
  viewportEl: HTMLElement;
  /** 水平內邊距，用於在兩側留白 */
  paddingX?: number;
  /** 項目與項目之間的間距，只在呼叫者有實際使用 style 時才生效 */
  gap?: number;
}) {
  const { layout, viewportEl, paddingX = 0, gap = 0 } = params;

  // 當佈局無效或可見區域寬度為 0 時，通常不可能發生
  if (layout.tracks.length === 0 || layout.yMax <= 0 || viewportEl.clientWidth <= 0) {
    return { visibleItems: [], masonryHeight: 0 };
  }

  // ---

  const pixelViewWidth = viewportEl.clientWidth - paddingX * 2;
  const pixelViewTop = viewportEl.scrollTop;
  const pixelViewBottom = pixelViewTop + viewportEl.clientHeight;

  const pixelColumnWidth = pixelViewWidth / layout.tracks.length;
  const pixelMasonryHeight = layout.yMax * pixelColumnWidth;

  // 當可見區域完全在內容之外時，通常不可能發生，或者發生在 paddingX 大於 viewport 寬度時
  if (pixelViewBottom <= 0 || pixelViewTop >= pixelMasonryHeight || pixelColumnWidth <= 0) {
    return { visibleItems: [], masonryHeight: pixelMasonryHeight };
  }

  // ---

  const weightViewTop = pixelViewTop / pixelColumnWidth;
  const weightViewBottom = pixelViewBottom / pixelColumnWidth;

  /** 使用二分搜尋找到第一個可見項目 */
  const findFirstInView = (track: MasonryTrack<T>) => {
    let low = 0;
    let high = track.length - 1;
    let firstInView = -1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (track[mid].yEnd > weightViewTop) {
        firstInView = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return firstInView;
  };

  /** 使用二分搜尋找到最後一個可見項目 */
  const findLastInView = (track: MasonryTrack<T>, firstInView: number) => {
    let low = firstInView;
    let high = track.length - 1;
    let lastInView = firstInView;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (track[mid].yStart > weightViewBottom) {
        high = mid - 1;
      } else {
        lastInView = mid;
        low = mid + 1;
      }
    }

    return lastInView;
  };

  // ---

  const visibleItems: MasonryItem<T>[] = [];

  for (let column = 0; column < layout.tracks.length; column++) {
    const track = layout.tracks[column];
    if (track.length === 0) continue;

    const firstInView = findFirstInView(track);
    if (firstInView < 0) continue;

    const lastInView = findLastInView(track, firstInView);

    for (let i = firstInView; i <= lastInView; i++) {
      const { item, yStart, yEnd } = track[i];

      const pixelX = column * pixelColumnWidth + paddingX;
      const pixelY = yStart * pixelColumnWidth;
      const pixelW = pixelColumnWidth;
      const pixelH = (yEnd - yStart) * pixelColumnWidth;

      let style = `position: absolute; left: 0px; top: 0px; width: ${pixelW}px; height: ${pixelH}px; transform: translate3d(${pixelX}px, ${pixelY}px, 0);`;

      if (gap > 0) {
        style += `box-sizing: border-box; padding: ${gap / 2}px;`;

        if (column === 0) {
          style += `padding-left: 0px;`;
        } else if (column === layout.tracks.length - 1) {
          style += `padding-right: 0px;`;
        }
      }

      visibleItems.push({ ...item, pixelX, pixelY, pixelW, pixelH, style });
    }
  }

  return { visibleItems, masonryHeight: pixelMasonryHeight };
}
