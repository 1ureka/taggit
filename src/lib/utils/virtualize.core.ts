import type { ItemWithSize } from "$lib/types";

/**
 * 權重轉像素的縮放模式
 *
 * - `proportional`：權重＝寬高比，換算像素時乘上欄寬，欄寬變動時項目跟著等比例縮放（瀑布流牆）
 * - `fixed`：權重本身就是最終像素高度，不受欄寬影響（固定列高清單）
 */
export type VirtualizeSizing = { mode: "proportional" } | { mode: "fixed"; itemHeight: number };

/**
 * 單個項目在軌道中的垂直權重位置資訊
 */
interface VirtualizeTrackItem<T> {
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
type VirtualizeTrack<T> = VirtualizeTrackItem<T>[];

/**
 * 多個軌道，第一層為欄位，第二層為軌道 (`[column][item_index]`)
 */
type VirtualizeTracks<T> = VirtualizeTrack<T>[];

/**
 * 以權重為基礎的虛擬化佈局結果
 */
export interface VirtualizeLayout<T> {
  /** 多個軌道，第一層為欄位，第二層為軌道 (`[column][item_index]`) */
  tracks: VirtualizeTracks<T>;
  /** 所有軌道中的最大權重高度 */
  yMax: number;
}

/**
 * 帶有最終渲染像素座標的虛擬化項目
 */
export type VirtualizeItem<T> = T & {
  pixelX: number;
  pixelY: number;
  pixelW: number;
  pixelH: number;
  style: string;
};

export type { ItemWithSize };

// ---

/**
 * 貪婪權重式欄位分配佈局
 *
 * `sizing` 為 `fixed` 時，`items` 只需要 `id`，不需要 `width`/`height`；
 * 為 `proportional`（預設）時，`items` 需符合 {@link ItemWithSize}。
 */
export function createVirtualizeLayout<T extends { id: string }>(params: {
  /** 項目陣列 */
  items: T[];
  /** 欄位數量 */
  columns: number;
  /** 權重轉像素的縮放模式，預設 `{ mode: "proportional" }` */
  sizing?: VirtualizeSizing;
}): VirtualizeLayout<T> {
  const { items } = params;
  const sizing = params.sizing ?? { mode: "proportional" as const };
  const columns = Math.max(1, Math.floor(params.columns));

  if (items.length === 0) {
    return { tracks: Array.from({ length: columns }, () => []), yMax: 0 };
  }

  const columnHeights = new Float64Array(columns);
  const tracks: VirtualizeTracks<T> = Array.from({ length: columns }, () => []);
  let yMax = 0;

  for (const item of items) {
    // fixed 模式下權重就是呼叫端指定的像素高度本身；proportional 模式下權重是寬高比（寬為 0 則視為 1:1）
    const heightRatio =
      sizing.mode === "fixed"
        ? sizing.itemHeight
        : (item as unknown as ItemWithSize).width > 0
          ? (item as unknown as ItemWithSize).height / (item as unknown as ItemWithSize).width
          : 1;

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
 * 基於虛擬化佈局的二分搜尋可視項目計算器
 *
 * - viewportEl 只能包含 contentEl (包含所有 visibleItems 的容器) 作為直接子元素
 * - viewportEl 與 contentEl 不得包含 padding, border 等 CSS 屬性
 */
export function createVirtualizeContent<T extends { id: string }>(params: {
  /** 以權重為基礎的虛擬化佈局結果 */
  layout: VirtualizeLayout<T>;
  /** 滾動容器的 DOM 元素，必須包含 contentEl 作為直接子元素 */
  viewportEl: HTMLElement;
  /** 水平內邊距，用於在兩側留白 */
  paddingX?: number;
  /** 垂直內邊距，用於在上下留白 */
  paddingY?: number;
  /** 項目與項目之間的間距，只在呼叫者有實際使用 style 時才生效 */
  gap?: number;
  /** 權重轉像素的縮放模式，必須跟建立 layout 時使用的 sizing 一致，預設 `{ mode: "proportional" }` */
  sizing?: VirtualizeSizing;
}): { visibleItems: VirtualizeItem<T>[]; contentHeight: number } {
  const { layout, viewportEl, paddingX = 0, paddingY = 0, gap = 0 } = params;
  const sizing = params.sizing ?? { mode: "proportional" as const };

  // 當佈局無效或可見區域寬度為 0 時，通常不可能發生
  if (layout.tracks.length === 0 || layout.yMax <= 0 || viewportEl.clientWidth <= 0) {
    return { visibleItems: [], contentHeight: 0 };
  }

  // ---

  const pixelViewWidth = viewportEl.clientWidth - paddingX * 2;
  const pixelViewTop = viewportEl.scrollTop - paddingY;
  const pixelViewBottom = pixelViewTop + viewportEl.clientHeight;

  // 水平方向的欄寬換算，永遠用於 pixelX/pixelW，不受 sizing 影響
  const pixelColumnWidth = pixelViewWidth / layout.tracks.length;
  // 垂直方向的權重→像素換算係數：fixed 模式下權重已是像素值，係數為 1；proportional 模式下等於欄寬
  const weightToPixel = sizing.mode === "fixed" ? 1 : pixelColumnWidth;
  const pixelContentHeight = layout.yMax * weightToPixel + paddingY * 2;

  // 當可見區域完全在內容之外時，通常不可能發生，或者發生在 paddingX 大於 viewport 寬度時
  if (pixelViewBottom <= 0 || pixelViewTop >= pixelContentHeight || pixelColumnWidth <= 0) {
    return { visibleItems: [], contentHeight: pixelContentHeight };
  }

  // ---

  const weightViewTop = pixelViewTop / weightToPixel;
  const weightViewBottom = pixelViewBottom / weightToPixel;

  /** 使用二分搜尋找到第一個可見項目 */
  const findFirstInView = (track: VirtualizeTrack<T>) => {
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
  const findLastInView = (track: VirtualizeTrack<T>, firstInView: number) => {
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

  const visibleItems: VirtualizeItem<T>[] = [];

  for (let column = 0; column < layout.tracks.length; column++) {
    const track = layout.tracks[column];
    if (track.length === 0) continue;

    const firstInView = findFirstInView(track);
    if (firstInView < 0) continue;

    const lastInView = findLastInView(track, firstInView);

    for (let i = firstInView; i <= lastInView; i++) {
      const { item, yStart, yEnd } = track[i];

      const pixelX = column * pixelColumnWidth + paddingX;
      const pixelY = yStart * weightToPixel + paddingY;
      const pixelW = pixelColumnWidth;
      const pixelH = (yEnd - yStart) * weightToPixel;

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

  return { visibleItems, contentHeight: pixelContentHeight };
}

// ---

/**
 * 取得指定 id 項目在目前視口下的像素位置（相對於 contentEl 頂端）。
 *
 * 與 {@link createVirtualizeContent} 用同一套座標公式，是像素座標的唯一來源，
 * 呼叫端不需自行重算。尚未量測（無 viewportEl／無欄）或找不到項目時回傳 null。
 * gap 只是項目 box 內的 padding、不影響位置，故此處不需納入。
 */
export function getItemPixelRect<T extends { id: string }>(params: {
  /** 以權重為基礎的虛擬化佈局結果 */
  layout: VirtualizeLayout<T>;
  /** 要查詢的項目 id */
  id: string;
  /** 滾動容器的 DOM 元素 */
  viewportEl: HTMLElement;
  /** 水平內邊距，用於在兩側留白 */
  paddingX?: number;
  /** 垂直內邊距，用於在上下留白 */
  paddingY?: number;
  /** 權重轉像素的縮放模式，必須跟建立 layout 時使用的 sizing 一致，預設 `{ mode: "proportional" }` */
  sizing?: VirtualizeSizing;
}): { top: number; height: number } | null {
  const { layout, id, viewportEl, paddingX = 0, paddingY = 0 } = params;
  const sizing = params.sizing ?? { mode: "proportional" as const };

  const columns = layout.tracks.length;
  if (columns === 0) return null;

  const pixelColumnWidth = (viewportEl.clientWidth - paddingX * 2) / columns;
  if (pixelColumnWidth <= 0) return null;

  const weightToPixel = sizing.mode === "fixed" ? 1 : pixelColumnWidth;

  for (const track of layout.tracks) {
    const found = track.find((t) => t.item.id === id);
    if (found === undefined) continue;
    return {
      top: found.yStart * weightToPixel + paddingY,
      height: (found.yEnd - found.yStart) * weightToPixel,
    };
  }
  return null;
}
