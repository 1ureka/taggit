/**
 * Svelte action that positions a floating element relative to a reference element
 * using @floating-ui/dom. Handles portal-to-body, auto-update, and cleanup.
 *
 * Usage:
 *   <div use:float={{ reference: triggerEl, open, options }}>…</div>
 */
import {
  computePosition,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  type Placement,
  type Middleware,
} from "@floating-ui/dom";

export interface FloatOptions {
  /** The reference (anchor) element */
  reference: HTMLElement | undefined;
  /** Whether the floating element is currently visible */
  open: boolean;
  /** Preferred placement (default: 'bottom-start') */
  placement?: Placement;
  /** Offset in px from reference (default: 4) */
  offset?: number;
  /** Whether to match the width of the reference element (default: true) */
  matchWidth?: boolean;
  /** Whether to set minWidth to match the reference element (default: false) */
  matchMinWidth?: boolean;
  /** Extra middleware to append */
  middleware?: Middleware[];
}

export function float(node: HTMLElement, opts: FloatOptions) {
  let cleanup: (() => void) | undefined;

  // Portal the node to <body> so it escapes any overflow/transform ancestors
  document.body.appendChild(node);

  function apply(o: FloatOptions) {
    // Tear down previous auto-update listener
    cleanup?.();
    cleanup = undefined;

    if (!o.open || !o.reference) {
      node.style.display = "none";
      return;
    }

    node.style.display = "";

    const mw: Middleware[] = [offset(o.offset ?? 4), flip({ padding: 8 }), shift({ padding: 8 })];

    if (o.matchWidth !== false) {
      mw.push(
        size({
          apply({ rects }) {
            Object.assign(node.style, { width: `${rects.reference.width}px` });
          },
          padding: 8,
        }),
      );
    } else if (o.matchMinWidth) {
      mw.push(
        size({
          apply({ rects }) {
            Object.assign(node.style, { minWidth: `${rects.reference.width}px` });
          },
          padding: 8,
        }),
      );
    }

    if (o.middleware) mw.push(...o.middleware);

    const placement = o.placement ?? "bottom-start";

    // Position once immediately, then auto-update on scroll/resize/layout
    cleanup = autoUpdate(o.reference, node, () => {
      if (!o.reference) return;
      computePosition(o.reference, node, {
        placement,
        middleware: mw,
      }).then(({ x, y }) => {
        Object.assign(node.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      });
    });
  }

  apply(opts);

  return {
    update(newOpts: FloatOptions) {
      apply(newOpts);
    },
    destroy() {
      cleanup?.();
      // Remove the portalled node from body
      if (node.parentNode === document.body) {
        document.body.removeChild(node);
      }
    },
  };
}
