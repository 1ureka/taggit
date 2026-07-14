import type { Snippet } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { Placement } from "@floating-ui/dom";

/**
 * ?
 */
type TooltipOptions = {
  content: string | Snippet;
  placement?: Placement;
  openDelay?: number;
  closeDelay?: number;
};

/**
 * ?
 */
type TooltipContext = {
  anchor: HTMLElement;
  content: string | Snippet;
  placement: Placement;
};

/**
 * ?
 */
export const tooltip: (options: TooltipOptions) => Attachment = (options) => {
  const { content, placement = "bottom", openDelay = 50, closeDelay = 300 } = options;

  return (node) => {
    let openTimer: ReturnType<typeof setTimeout>;
    let closeTimer: ReturnType<typeof setTimeout>;
    let currentCtx: TooltipContext | null = null;

    const overwrite = () => {
      window.dispatchEvent(new CustomEvent("tooltip", { detail: { ctx: { anchor: node, content, placement } } }));
    };

    const clean = () => {
      if (currentCtx?.anchor === node) {
        window.dispatchEvent(new CustomEvent("tooltip", { detail: { ctx: null } }));
      }
    };

    const handleTooltip = (event: Event) => {
      currentCtx = (event as CustomEvent).detail.ctx;
    };

    const handleMouseEnter = () => {
      clearTimeout(closeTimer);
      openTimer = setTimeout(overwrite, openDelay);
    };

    const handleMouseLeave = () => {
      clearTimeout(openTimer);
      closeTimer = setTimeout(clean, closeDelay);
    };

    const handleFocus = () => {
      overwrite();
    };

    const handleBlur = () => {
      clearTimeout(openTimer);
      closeTimer = setTimeout(clean, closeDelay);
    };

    node.addEventListener("mouseenter", handleMouseEnter);
    node.addEventListener("mouseleave", handleMouseLeave);
    node.addEventListener("focus", handleFocus);
    node.addEventListener("blur", handleBlur);
    window.addEventListener("tooltip", handleTooltip);

    return () => {
      clean();

      clearTimeout(openTimer);
      clearTimeout(closeTimer);

      node.removeEventListener("mouseenter", handleMouseEnter);
      node.removeEventListener("mouseleave", handleMouseLeave);
      node.removeEventListener("focus", handleFocus);
      node.removeEventListener("blur", handleBlur);
      window.removeEventListener("tooltip", handleTooltip);
    };
  };
};

/**
 * ?
 */
export class TooltipState {
  open = $state(false);
  anchor = $state<HTMLElement | null>(null);
  content = $state<string | Snippet | null>(null);
  placement = $state<Placement>("bottom");

  handleTooltip = (event: Event) => {
    const ctx = (event as CustomEvent).detail.ctx;

    if (ctx === null) {
      this.open = false;
      this.anchor = null;
      return;
    }

    this.open = true;
    this.anchor = ctx.anchor;
    this.content = ctx.content;
    this.placement = ctx.placement;
  };

  constructor() {
    $effect(() => {
      window.addEventListener("tooltip", this.handleTooltip);
      return () => {
        window.removeEventListener("tooltip", this.handleTooltip);
      };
    });
  }
}
