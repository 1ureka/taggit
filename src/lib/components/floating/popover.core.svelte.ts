import { crossfade, fly } from "svelte/transition";
import { computePosition, autoUpdate, arrow, flip, offset, shift, size } from "@floating-ui/dom";
import type { Placement, Middleware, ElementRects } from "@floating-ui/dom";
import { Spring } from "svelte/motion";

/** placement 對應的「箭頭附著側」（與 placement 相反） */
const ARROW_SIDE = { top: "bottom", right: "left", bottom: "top", left: "right" } as const;
type ArrowSide = (typeof ARROW_SIDE)[keyof typeof ARROW_SIDE];

/**
 * Popover 互動邏輯的參數型別
 */
type PopoverOptions = {
  /** 開關狀態 */
  open: boolean;
  /** 參照元素（定位錨點） */
  reference: HTMLElement | undefined;
  /** 偏好位置 */
  placement: Placement;
  /** 是否匹配參照元素寬度 */
  matchWidth: boolean;
  /** 離參照元素的距離 */
  offset: number;
  /** 是否啟用箭頭 */
  arrow: boolean;
};

/**
 * Popover 的互動邏輯
 */
export class Popover {
  /** popover 容器的 DOM 引用 */
  popoverEl = $state<HTMLDivElement>();
  /** 箭頭元素的 DOM 引用（僅在啟用 arrow 時使用，可為 SVG 元素） */
  arrowEl = $state<Element>();
  /** 是否為第一次計算座標 */
  firstUpdate = true;
  /** popover 的 x 座標 */
  x = new Spring(0);
  /** popover 的 y 座標 */
  y = new Spring(0);
  /** popover 的寬度 */
  width = $state(0);
  /** 箭頭的 x 座標 */
  arrowX = $state<number | null>(null);
  /** 箭頭的 y 座標 */
  arrowY = $state<number | null>(null);
  /** 箭頭附著於 popover 的哪一側 */
  arrowSide = $state<ArrowSide>("top");

  constructor(private options: PopoverOptions) {
    // 監聽選項變化，當關閉時重新計算確保離場動畫在正確的位置，當開啟時啟用 autoUpdate 以持續更新位置
    // #compute 利用參數接受參照，確保只使用該次 effect 的引用，不會因為 this.options 的變化而改變參照
    $effect(() => {
      const { reference, open, placement } = this.options;
      const node = this.popoverEl;
      if (!reference || !node) return;

      if (!open) {
        this.#compute(node, reference, placement);
        return;
      }

      if (!node.matches(":popover-open")) {
        node.showPopover();
        this.firstUpdate = true;
      }

      return autoUpdate(reference, node, () => this.#compute(node, reference, placement), { animationFrame: true });
    });
  }

  // ---

  /** 建立 Floating UI 的 middleware */
  #buildMiddleware(): Middleware[] {
    const middleware: Middleware[] = [offset(this.options.offset), flip({ padding: 8 }), shift({ padding: 8 })];

    if (this.options.matchWidth) {
      const apply = ({ rects }: { rects: ElementRects }) => {
        this.width = rects.reference.width;
      };
      middleware.push(size({ apply, padding: 8 }));
    }

    if (this.options.arrow && this.arrowEl) {
      middleware.push(arrow({ element: this.arrowEl, padding: 8 }));
    }

    return middleware;
  }

  /** 建立 middleware 並計算 popover 的寬度後計算位置 */
  #compute(node: HTMLElement, reference: HTMLElement, placement: Placement) {
    const middleware = this.#buildMiddleware();
    const config = { strategy: "fixed", placement, middleware } as const;

    computePosition(reference, node, config).then(({ x, y, placement: finalPlacement, middlewareData }) => {
      this.x.set(x, { instant: this.firstUpdate });
      this.y.set(y, { instant: this.firstUpdate });
      this.firstUpdate = false;

      if (this.options.arrow && middlewareData.arrow) {
        const { x: ax, y: ay } = middlewareData.arrow;
        this.arrowX = ax ?? null;
        this.arrowY = ay ?? null;
        const side = finalPlacement.split("-")[0] as keyof typeof ARROW_SIDE;
        this.arrowSide = ARROW_SIDE[side];
      }
    });
  }

  // ---

  /** outro 動畫結束後呼叫，隱藏原生 popover */
  handleOutroEnd = () => {
    if (!this.options.open && this.popoverEl?.matches(":popover-open")) {
      this.popoverEl.hidePopover();
    }
  };
}

/**
 * Popover ?
 */
export const [popoverIntro, popoverOutro] = crossfade({
  duration: 150,
  fallback(node) {
    return fly(node, { duration: 150, opacity: 0, y: -8 });
  },
});
