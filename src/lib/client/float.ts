/**
 * Svelte action that positions a floating element relative to a reference element
 * using @floating-ui/dom. Handles portal-to-body, auto-update, and cleanup.
 *
 * Key design: uses `strategy: 'fixed'` so the portalled node is always
 * viewport-relative and NEVER affects document scrollWidth/scrollHeight,
 * eliminating spurious overflow-x regardless of the element's coordinates.
 *
 * Usage:
 *   <div use:float={{ reference: triggerEl, open }}>…</div>
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

  /** ? */
  let cleanup: (() => void) | undefined;

  /** ? */
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

  /** ? */
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

  /** ? */
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
