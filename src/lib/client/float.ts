/**
 * @file float.ts
 * Svelte action —— 使用 @floating-ui/dom 將浮動元素定位於參照元素旁。
 *
 * 設計要點：採用 `strategy: 'fixed'`，使 portal 節點始終以視窗為基準定位，
 * 不會影響 document 的 scrollWidth/scrollHeight，避免產生多餘的橫向捲軸。
 *
 * 使用方式：
 *   `<div use:float={{ reference: triggerEl, open }}>…</div>`
 */
import { computePosition, autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import type { Placement, Middleware, ElementRects } from "@floating-ui/dom";

type FloatOptions = {
  /** The reference (anchor) element */
  reference: HTMLElement | undefined;
  /** Whether the floating element is currently visible */
  open: boolean;
  /** Preferred placement (default: 'bottom-start') */
  placement?: Placement;
  /** Whether to match the width of the reference element (default: true) */
  matchWidth?: boolean;
};

export function float(node: HTMLElement, opts: FloatOptions) {
  document.body.appendChild(node);
  node.dataset.open = "false";

  /** autoUpdate 回傳的清除函式，用於停止自動重算 */
  let cleanup: (() => void) | undefined;

  /** 依據選項建構 Floating UI 的 middleware 陣列 */
  function buildMiddleware(o: FloatOptions): Middleware[] {
    const middleware: Middleware[] = [offset(4), flip({ padding: 8 }), shift({ padding: 8 })];

    if (o.matchWidth !== false) {
      const apply = ({ rects }: { rects: ElementRects }) => {
        Object.assign(node.style, { width: `${rects.reference.width}px` });
      };

      middleware.push(size({ apply, padding: 8 }));
    }

    return middleware;
  }

  /** 使用 computePosition 重新計算浮動元素位置 */
  function recompute(o: FloatOptions) {
    if (!o.reference) return;

    computePosition(o.reference, node, {
      strategy: "fixed",
      placement: o.placement ?? "bottom-start",
      middleware: buildMiddleware(o),
    }).then(({ x, y }) => {
      Object.assign(node.style, { left: `${x}px`, top: `${y}px` });
    });
  }

  /** 根據 open 狀態啟停 autoUpdate 並觸發初次定位 */
  function apply(o: FloatOptions) {
    cleanup?.();
    cleanup = undefined;

    node.dataset.open = o.open ? "true" : "false";

    if (!o.reference) return;

    if (o.open) {
      // Live auto-update while open: repositions on scroll / resize / layout shifts.
      cleanup = autoUpdate(o.reference, node, () => recompute(o));
    } else {
      // One-shot recompute on close so the exit animation plays from the correct
      // position. No timer or reset needed: `position: fixed` nodes never affect
      // document overflow regardless of their left/top values.
      recompute(o);
    }
  }

  apply(opts);

  return {
    update(newOpts: FloatOptions) {
      apply(newOpts);
    },
    destroy() {
      cleanup?.();
      if (node.parentNode === document.body) {
        document.body.removeChild(node);
      }
    },
  };
}
