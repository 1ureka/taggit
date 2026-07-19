import type { ItemWithSize } from "$lib/types";

/** 播放器引擎的佈局結果 */
interface PlayerLayout {
  /** 每張圖片的 X 偏移（像素） */
  offsets: number[];
  /** 每張圖片的寬度（像素） */
  widths: number[];
  /** 整條圖片帶的總寬度 */
  stripWidth: number;
}

/** 帶有虛擬化樣式的圖片帶項目 */
type PlayerStripItem<T extends ItemWithSize> = T & {
  /** 用於 keyed 渲染的唯一鍵：`${copyIndex}_${id}` */
  key: string;
  /** 在圖片帶中的水平像素偏移 */
  pixelX: number;
  /** 渲染寬度 */
  pixelW: number;
  /** 內聯虛擬化樣式（position:absolute + left + width + height） */
  style: string;
};

/** 播放器進度資訊 */
type PlayerProgress = {
  /** 當前的攝影機水平位置 */
  cameraX: number;
  /** 當前的圖片帶的進度 (0–1000) */
  progressValue: number;
  /** 當前的圖片索引 */
  currentIndex: number;
};

/** 播放器引擎需要的參數 */
interface PlayerEngineParams<T extends ItemWithSize> {
  /** 要播放的圖片資料 */
  images: T[];
  /** 可見項目更新回調 */
  onVisibleItemsChange: (visibleItems: PlayerStripItem<T>[]) => void;
  /** 進度更新回調 */
  onProgressChange: (progress: PlayerProgress) => void;
}

export type { PlayerStripItem, PlayerProgress };

// ---

/**
 * 非響應式的播放器引擎。
 * 封裝 rAF 迴圈、佈局計算、虛擬化與進度追蹤。
 * 假設播放器的高度等同於視窗高度，圖片寬度按比例縮放以填滿高度。
 */
export class PlayerEngine<T extends ItemWithSize> {
  /** 當前佈局 */
  private layout: PlayerLayout = { offsets: [], widths: [], stripWidth: 0 };
  /** 當前的攝影機水平位置 */
  private cameraX = 0;
  /** 上一次計算可見項目時的攝影機水平位置，用於計算移動距離，決定是否需要重新計算 */
  private cameraXLastComputed = -Infinity;
  /** 上一幀的攝影機水平位置 */
  private cameraXLastFrame = 0;

  /** 當前速度 */
  private speed = 1.5;
  /** 是否正在播放 */
  private playing = false;
  /** 是否正在拖曳進度條 */
  private seeking = false;
  /** 長按加速時的暫時速度（含方向），非 null 時優先於 playing/speed 推進攝影機，暫停中也會生效 */
  private boostSpeed: number | null = null;
  /** 上一次 rAF 的時間戳，用於計算時間差來決定攝影機水平位置的增量 */
  private lastTime = 0;

  /** rAF 的 ID，用於取消動畫 */
  private rafId: number | null = null;

  /** 緩衝區像素，用於提前渲染可見項目 */
  private readonly bufferPx = 2000;
  /** 更新閾值，當攝影機水平位置的差值超過此值時重新計算可見項目 */
  private readonly updateThreshold = 500;

  constructor(private params: PlayerEngineParams<T>) {}

  // ---

  /**
   * 根據圖片資料、螢幕高度計算佈局
   */
  private buildLayout(): PlayerLayout {
    const vh = window.innerHeight;
    const offsets: number[] = [];
    const widths: number[] = [];

    let x = 0;
    for (const img of this.params.images) {
      const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
      const w = Math.round(vh * ratio);
      offsets.push(x);
      widths.push(w);
      x += w;
    }

    return { offsets, widths, stripWidth: x };
  }

  // ---

  /**
   * 啟動 rAF 迴圈，進行首次佈局
   */
  start(): void {
    this.layout = this.buildLayout();
    this.cameraX = 0;
    this.cameraXLastComputed = -Infinity;
    this.rafId = requestAnimationFrame(this.tick);
  }

  /**
   * 停止 rAF 迴圈並釋放資源
   */
  dispose(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ---

  /**
   * 切換播放/暫停
   */
  togglePlay(): void {
    this.playing = !this.playing;
    if (this.playing) this.lastTime = 0;
  }

  /**
   * 設定速度
   */
  setSpeed(value: number): void {
    this.speed = value;
  }

  /**
   * 開始拖曳進度條，暫停動畫推進
   */
  seekStart(pct: number): void {
    this.seeking = true;
    this.cameraX = pct * this.layout.stripWidth;
  }

  /**
   * 拖曳中，更新位置
   */
  seekMove(pct: number): void {
    this.seeking = true;
    this.cameraX = pct * this.layout.stripWidth;
  }

  /**
   * 結束拖曳，恢復動畫推進
   */
  seekEnd(): void {
    this.seeking = false;
    this.lastTime = 0;
  }

  /**
   * 視窗大小變更，重新佈局並按比例調整 cameraX
   */
  resize(): void {
    const pct = this.layout.stripWidth > 0 ? this.cameraX / this.layout.stripWidth : 0;
    this.layout = this.buildLayout();
    this.cameraX = pct * this.layout.stripWidth;
    this.cameraXLastComputed = -Infinity;
  }

  /**
   * 開始長按加速：以指定的速度（含方向、可超出一般速度範圍）持續推進攝影機，
   * 不受 playing/seeking 狀態影響（暫停中長按也能預覽快轉/倒轉）
   */
  startBoost(speed: number): void {
    this.boostSpeed = speed;
    this.lastTime = 0;
  }

  /**
   * 結束長按加速，恢復原本的 playing/speed 推進邏輯
   */
  endBoost(): void {
    this.boostSpeed = null;
    this.lastTime = 0;
  }

  /**
   * 以目前顯示中的圖片為基準，跳到前後第 delta 張（依無限捲動邊界折返，不影響 playing 狀態）
   */
  jumpBy(delta: number): void {
    const { offsets, stripWidth } = this.layout;
    const n = this.params.images.length;
    if (n === 0 || stripWidth <= 0) return;

    const { currentIndex } = this.computeProgress();
    const targetIndex = (((currentIndex + delta) % n) + n) % n;

    this.cameraX = offsets[targetIndex];
    this.cameraXLastComputed = -Infinity;
  }

  // ---

  /**
   * rAF 迴圈的回調函數
   */
  private tick = (ts: number): void => {
    // 長按加速優先於一般播放推進，暫停中也會生效
    if (this.boostSpeed !== null && this.layout.stripWidth > 0) {
      if (!this.lastTime) this.lastTime = ts;
      const dt = ts - this.lastTime;
      this.lastTime = ts;
      this.cameraX += this.boostSpeed * (dt / 16.667);
    } else if (this.playing && !this.seeking && this.layout.stripWidth > 0) {
      if (!this.lastTime) this.lastTime = ts;
      const dt = ts - this.lastTime;
      this.lastTime = ts;
      this.cameraX += this.speed * (dt / 16.667);
    }

    // 處理無限迴圈捲繞，強制重新計算可見項目
    if (this.cameraX >= this.layout.stripWidth) {
      this.cameraX -= this.layout.stripWidth;
      this.cameraXLastComputed = -Infinity;
    } else if (this.cameraX < 0) {
      this.cameraX += this.layout.stripWidth;
      this.cameraXLastComputed = -Infinity;
    }

    // 閾值交叉，標記是否需要重新計算可見項目
    if (Math.abs(this.cameraX - this.cameraXLastComputed) >= this.updateThreshold) {
      const visibleItems = this.computeVisibleItems();
      this.params.onVisibleItemsChange(visibleItems);
      this.cameraXLastComputed = this.cameraX;
    }

    // 推送需要及時反映的資訊，除非 cameraX 沒有變化
    if (this.cameraX !== this.cameraXLastFrame) {
      this.params.onProgressChange({ cameraX: this.cameraX, ...this.computeProgress() });
    }

    this.cameraXLastFrame = this.cameraX;
    this.rafId = requestAnimationFrame(this.tick);
  };

  // ---

  /**
   * 計算當前可見的圖片項目與無限迴圈複本
   */
  private computeVisibleItems(): PlayerStripItem<T>[] {
    const { offsets, widths, stripWidth } = this.layout;
    if (stripWidth <= 0 || this.params.images.length === 0) return [];

    const vw = window.innerWidth;
    const leftEdge = this.cameraX - this.bufferPx;
    const rightEdge = this.cameraX + vw + this.bufferPx;
    const startCopy = Math.floor(leftEdge / stripWidth);
    const endCopy = Math.floor(rightEdge / stripWidth);

    const items: PlayerStripItem<T>[] = [];

    for (let c = startCopy; c <= endCopy; c++) {
      const copyOffset = c * stripWidth;

      // 二分搜尋：找到第一個右邊緣超過 leftEdge 的圖片
      let lo = 0;
      let hi = this.params.images.length - 1;
      let first = this.params.images.length;

      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (offsets[mid] + widths[mid] + copyOffset > leftEdge) {
          first = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }

      // 從第一個可見圖片往後掃描，直到超出右邊緣
      for (let i = first; i < this.params.images.length; i++) {
        const imgLeft = offsets[i] + copyOffset;
        if (imgLeft >= rightEdge) break;

        const img = this.params.images[i];
        const pixelW = widths[i];

        items.push({
          ...img,
          key: `${c}_${img.id}`,
          pixelX: imgLeft,
          pixelW,
          style: `position:absolute;top:0;left:${imgLeft}px;width:${pixelW}px;height:100%;`,
        });
      }
    }

    return items;
  }

  /**
   * 計算當前進度值與可見圖片索引
   */
  private computeProgress(): { progressValue: number; currentIndex: number } {
    const { offsets, widths, stripWidth } = this.layout;
    if (stripWidth <= 0 || this.params.images.length === 0) {
      return { progressValue: 0, currentIndex: 0 };
    }

    const progressValue = Math.round((this.cameraX / stripWidth) * 1000);

    // 正規化 cameraX 到 [0, stripWidth) 範圍
    const pos = ((this.cameraX % stripWidth) + stripWidth) % stripWidth;

    // 二分搜尋：找到第一個右邊緣超過 pos 的圖片
    let lo = 0;
    let hi = this.params.images.length - 1;
    let currentIndex = this.params.images.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid] + widths[mid] > pos) {
        currentIndex = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    return { progressValue, currentIndex };
  }
}
