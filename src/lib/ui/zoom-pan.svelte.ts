/**
 * ZoomPan 的配置選項
 */
type ZoomPanOptions = {
  /** 最小縮放比例，預設 0.2 */
  minScale?: number;
  /** 最大縮放比例，預設 10 */
  maxScale?: number;
};

/**
 * 圖片縮放平移的無頭 UI
 */
export class ZoomPan {
  /** 目前縮放比例 */
  scale = $state(1);
  /** X 軸位移 */
  panX = $state(0);
  /** Y 軸位移 */
  panY = $state(0);
  /** 是否正在拖曳 */
  isDragging = $state(false);
  /** 目前的 CSS transform 字串 */
  transform: string;

  #minScale: number;
  #maxScale: number;
  #dragStartX = 0;
  #dragStartY = 0;
  #dragStartPanX = 0;
  #dragStartPanY = 0;

  constructor(options?: ZoomPanOptions) {
    this.#minScale = options?.minScale ?? 0.2;
    this.#maxScale = options?.maxScale ?? 10;
    this.transform = $derived(`translate(${this.panX}px,${this.panY}px) scale(${this.scale})`);
  }

  // ---

  /** 重置縮放與位移至初始狀態 */
  #reset() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  // ---

  /** 處理容器滾輪事件，執行縮放 */
  handleContainerWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.scale = Math.max(this.#minScale, Math.min(this.#maxScale, this.scale + delta * this.scale));
  };

  /** 處理容器滑鼠按下事件，開始拖曳 */
  handleContainerMousedown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    this.isDragging = true;
    this.#dragStartX = e.clientX;
    this.#dragStartY = e.clientY;
    this.#dragStartPanX = this.panX;
    this.#dragStartPanY = this.panY;
  };

  /** 處理容器重置事件，重置縮放與位移 */
  handleContainerReset = () => {
    this.#reset();
  };

  // ---

  /** 處理 Window 滑鼠移動事件，更新拖曳位置 */
  handleWindowMousemove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    this.panX = this.#dragStartPanX + (e.clientX - this.#dragStartX);
    this.panY = this.#dragStartPanY + (e.clientY - this.#dragStartY);
  };

  /** 處理 Window 滑鼠放開事件，結束拖曳 */
  handleWindowMouseup = () => {
    this.isDragging = false;
  };
}
