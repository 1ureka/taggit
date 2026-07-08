import { computePosition, autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import type { Placement, Middleware, ElementRects } from "@floating-ui/dom";

/**
 * Popover 互動邏輯的參數型別
 */
type PopoverOptions = {
  /** 開關狀態 */
  open: boolean;
  /** 參照元素（定位錨點） */
  reference: HTMLElement | undefined;
  /** 偏好位置，預設 'bottom-start' */
  placement: Placement;
  /** 是否匹配參照元素寬度，預設 true */
  matchWidth: boolean;
};

/**
 * Popover 的互動邏輯
 */
export class Popover {
  /** popover 容器的 DOM 引用 */
  popoverEl = $state<HTMLDivElement>();
  /** popover 的座標與尺寸 */
  coords = $state({ x: 0, y: 0, width: 0 });

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

      if (!node.matches(":popover-open")) node.showPopover();
      return autoUpdate(reference, node, () => this.#compute(node, reference, placement));
    });
  }

  // ---

  /** 建立 Floating UI 的 middleware */
  #buildMiddleware(): Middleware[] {
    const middleware: Middleware[] = [offset(4), flip({ padding: 8 }), shift({ padding: 8 })];

    if (!this.options.matchWidth) return middleware;

    const apply = ({ rects }: { rects: ElementRects }) => {
      this.coords.width = rects.reference.width;
    };

    middleware.push(size({ apply, padding: 8 }));
    return middleware;
  }

  /** 建立 middleware 並計算 popover 的寬度後計算位置 */
  #compute(node: HTMLElement, reference: HTMLElement, placement: Placement) {
    const middleware = this.#buildMiddleware();
    const config = { strategy: "fixed", placement, middleware } as const;

    computePosition(reference, node, config).then(({ x, y }) => {
      this.coords.x = x;
      this.coords.y = y;
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
