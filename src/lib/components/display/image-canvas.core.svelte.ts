import { Spring } from "svelte/motion";
import { untrack } from "svelte";

/**
 * ImageCanvas 互動邏輯的參數型別
 */
type ImageCanvasOptions = {
  /** 內容身分鍵，變化時重置縮放/平移 */
  resetKey: unknown;
  /** 最小縮放比例 */
  minScale: number;
  /** 最大縮放比例 */
  maxScale: number;
};

/**
 * ImageCanvas 的互動邏輯：滾輪/鍵盤縮放（以指標或容器中心為錨點）、拖曳/鍵盤平移，
 * 並對平移做軟邊界限制（拖曳可超出，放開後彈回）
 */
export class ImageCanvas {
  /** 容器（手勢偵測範圍）的 DOM 引用 */
  containerEl = $state<HTMLDivElement>();
  /** 內容 wrapper 的 DOM 引用，用來量測內容的原始（未縮放）尺寸 */
  contentEl = $state<HTMLDivElement>();

  /** 目前縮放比例 */
  scale = new Spring(1);
  /** X 軸位移 */
  panX = new Spring(0);
  /** Y 軸位移 */
  panY = new Spring(0);
  /** 是否正在拖曳 */
  isDragging = $state(false);
  /** 目前的 CSS transform 字串 */
  transform: string;

  #containerSize = $state({ width: 0, height: 0 });
  #contentSize = $state({ width: 0, height: 0 });

  #dragStartX = 0;
  #dragStartY = 0;
  #dragStartPanX = 0;
  #dragStartPanY = 0;

  constructor(private options: ImageCanvasOptions) {
    this.transform = $derived(`translate(${this.panX.current}px, ${this.panY.current}px) scale(${this.scale.current})`);

    // resetKey 變化時，鏡頭（scale/pan）以 spring 動畫飛回初始值
    $effect(() => {
      this.options.resetKey;
      untrack(() => this.#reset());
    });

    // 容器或內容尺寸變化（例如視窗縮放）時，若目前 pan 已不再合法，收斂回合法範圍
    $effect(() => {
      this.#containerSize;
      this.#contentSize;
      untrack(() => this.#settlePan());
    });
  }

  // ---

  /** Svelte action：量測容器尺寸 */
  measureContainer = (node: HTMLDivElement) => {
    const measure = () => {
      this.#containerSize = { width: node.offsetWidth, height: node.offsetHeight };
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(node);

    return { destroy: () => ro.disconnect() };
  };

  /** Svelte action：量測內容原始（未縮放）尺寸 */
  measureContent = (node: HTMLDivElement) => {
    const measure = () => {
      this.#contentSize = { width: node.offsetWidth, height: node.offsetHeight };
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(node);

    return { destroy: () => ro.disconnect() };
  };

  // ---

  /** 重置縮放與位移至初始狀態（spring 動畫） */
  #reset() {
    this.scale.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  /** 給定 scale，計算 pan 的合法邊界（內容邊緣最多對齊容器邊緣，內容比容器小則鎖在 0） */
  #panBounds(scale: number) {
    const scaledWidth = this.#contentSize.width * scale;
    const scaledHeight = this.#contentSize.height * scale;
    const maxX = Math.max(0, (scaledWidth - this.#containerSize.width) / 2);
    const maxY = Math.max(0, (scaledHeight - this.#containerSize.height) / 2);
    return { maxX, maxY };
  }

  /** 將 pan 限制在合法邊界內 */
  #clampToBounds(x: number, y: number, scale: number) {
    const { maxX, maxY } = this.#panBounds(scale);
    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY),
    };
  }

  /** 超出邊界時的彈性阻尼，拖曳中「拖得動但變沉」 */
  #rubberBand(value: number, max: number) {
    if (Math.abs(value) <= max) return value;
    const over = Math.abs(value) - max;
    return Math.sign(value) * (max + over * 0.35);
  }

  /** 若目前 pan 超出（尺寸變化後的）合法邊界，spring 動畫收斂回邊界內 */
  #settlePan() {
    const { x, y } = this.#clampToBounds(this.panX.current, this.panY.current, this.scale.current);
    this.panX.set(x);
    this.panY.set(y);
  }

  /** 以 (anchorX, anchorY)（相對容器中心的螢幕偏移）為錨點縮放，錨點在畫面上的位置保持不動 */
  #zoomAt(anchorX: number, anchorY: number, direction: 1 | -1) {
    const step = 0.2;
    const current = this.scale.current;
    const raw = current + direction * step * current;
    const next = Math.min(this.options.maxScale, Math.max(this.options.minScale, raw));
    const k = next / current;

    const rawX = this.panX.current * k + anchorX * (1 - k);
    const rawY = this.panY.current * k + anchorY * (1 - k);
    const { x, y } = this.#clampToBounds(rawX, rawY, next);

    this.scale.set(next);
    this.panX.set(x);
    this.panY.set(y);
  }

  /** 以固定步幅平移（鍵盤方向鍵用）；若該軸完全被邊界擋下（沒有合法範圍），改用 nudge 回饋 */
  #panBy(dx: number, dy: number) {
    const beforeX = this.panX.current;
    const beforeY = this.panY.current;
    const { x, y } = this.#clampToBounds(beforeX + dx, beforeY + dy, this.scale.current);

    if (dx !== 0 && x === beforeX) {
      this.#nudge(this.panX, dx);
    } else {
      this.panX.set(x);
    }

    if (dy !== 0 && y === beforeY) {
      this.#nudge(this.panY, dy);
    } else {
      this.panY.set(y);
    }
  }

  /** 邊界回饋：瞬間小位移，下一幀開始用 spring 彈回，讓使用者感覺「碰到牆」 */
  #nudge(spring: Spring<number>, direction: number) {
    const amount = Math.sign(direction) * 6;
    const target = spring.current;
    spring.set(target + amount, { instant: true });
    requestAnimationFrame(() => spring.set(target));
  }

  // ---

  /** 處理容器滾輪事件，以滑鼠指標位置為錨點縮放 */
  handleContainerWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!this.containerEl) return;

    const rect = this.containerEl.getBoundingClientRect();
    const anchorX = e.clientX - (rect.left + rect.width / 2);
    const anchorY = e.clientY - (rect.top + rect.height / 2);
    this.#zoomAt(anchorX, anchorY, e.deltaY > 0 ? -1 : 1);
  };

  /** 處理容器滑鼠按下事件，開始拖曳 */
  handleContainerMousedown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.#dragStartX = e.clientX;
    this.#dragStartY = e.clientY;
    this.#dragStartPanX = this.panX.current;
    this.#dragStartPanY = this.panY.current;
  };

  /** 處理容器雙擊事件，重置 */
  handleContainerDblclick = () => {
    this.#reset();
  };

  /** 處理容器鍵盤事件 */
  handleContainerKeydown = (e: KeyboardEvent) => {
    // Esc 或 Enter 或 Space：重置
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.#reset();
      return;
    }

    // Plus (+) 或 '='：放大（以容器中心為錨點，鍵盤沒有滑鼠位置可用）
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      this.#zoomAt(0, 0, 1);
      return;
    }

    // Minus (-) 或 '_'：縮小
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      this.#zoomAt(0, 0, -1);
      return;
    }

    // 方向鍵：平移（捲軸/地圖導航隱喻——ArrowRight 揭露右側內容，內容本身往左移，與滑鼠拖曳方向相反）
    const step = 40;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.#panBy(0, step);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.#panBy(0, -step);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.#panBy(step, 0);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      this.#panBy(-step, 0);
      return;
    }
  };

  // ---

  /** 處理 Window 滑鼠移動事件，拖曳中即時更新（instant），超出邊界時套用彈性阻尼 */
  handleWindowMousemove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const rawX = this.#dragStartPanX + (e.clientX - this.#dragStartX);
    const rawY = this.#dragStartPanY + (e.clientY - this.#dragStartY);
    const { maxX, maxY } = this.#panBounds(this.scale.current);

    this.panX.set(this.#rubberBand(rawX, maxX), { instant: true });
    this.panY.set(this.#rubberBand(rawY, maxY), { instant: true });
  };

  /** 處理 Window 滑鼠放開事件，結束拖曳並 spring 回彈至合法邊界 */
  handleWindowMouseup = () => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.#settlePan();
  };
}
