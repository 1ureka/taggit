import { Spring } from "svelte/motion";

type Side = "top" | "bottom" | "left" | "right";

type DrawerOptions = {
  open: boolean;
  side: Side;
  onclose?: () => void;
};

export class Drawer {
  dialogEl = $state<HTMLDialogElement | undefined>();
  // ::backdrop 點擊時 e.target === dialogEl，而非 innerEl，藉此辨別
  innerEl = $state<HTMLDivElement | undefined>();
  // 純粹的數學物件，無需等待 DOM。
  spring = new Spring(0, { stiffness: 0.08, damping: 0.65 });

  // 關閉動畫進行中時禁止互動，開啟時立即為 true，關閉時立即（不等動畫）為 false
  interactable = $state(false);

  #dragging = false;
  #dragStart: number | null = null;

  constructor(private options: DrawerOptions) {
    $effect(() => {
      const { open } = this.options;
      const node = this.dialogEl;
      if (!node) return;

      if (open) {
        if (!node.open) node.showModal();
        this.interactable = true;
        this.spring.set(1).catch(() => {});
      } else {
        if (!node.open) return;
        this.interactable = false;
        this.spring
          .set(0)
          .then(() => {
            if (!this.options.open && node.open) {
              node.close();
            }
          })
          .catch(() => {});
      }
    });
  }

  // ::backdrop 點擊時，e.target 是 dialog 元素本身（不會是 innerEl 或其子節點）
  handleClick = (event: MouseEvent) => {
    if (event.target === this.dialogEl) {
      this.options.onclose?.();
    }
  };

  // ---

  handlePointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.#dragStart = this.#primaryAxis(e);
    this.#dragging = true;
  };

  handlePointerMove = (e: PointerEvent) => {
    if (!this.#dragging || this.#dragStart === null || !this.dialogEl) return;
    const delta = this.#closingDelta(e, this.#dragStart);
    const size = this.#drawerSize();
    if (size === 0) return;
    const rawProgress = 1 - delta / size;
    let progress: number;
    if (rawProgress <= 1) {
      progress = Math.max(0, rawProgress);
    } else {
      progress = 1 + (rawProgress - 1) * 0.15;
    }
    this.spring.set(progress, { instant: true });
  };

  handlePointerUp = () => {
    if (!this.#dragging) return;
    this.#dragging = false;
    this.#dragStart = null;
    if (this.spring.current < 0.5) {
      this.options.onclose?.();
    } else {
      this.spring.set(1);
    }
  };

  handlePointerCancel = () => {
    if (!this.#dragging) return;
    this.#dragging = false;
    this.#dragStart = null;
    this.spring.set(1);
  };

  // ---

  #primaryAxis(e: PointerEvent): number {
    const { side } = this.options;
    return side === "left" || side === "right" ? e.clientX : e.clientY;
  }

  #closingDelta(e: PointerEvent, start: number): number {
    const current = this.#primaryAxis(e);
    switch (this.options.side) {
      case "left":
        return start - current; // 向左拖 → 關閉
      case "right":
        return current - start; // 向右拖 → 關閉
      case "top":
        return start - current; // 向上拖 → 關閉
      case "bottom":
        return current - start; // 向下拖 → 關閉
    }
  }

  #drawerSize(): number {
    if (!this.dialogEl) return 0;
    const { side } = this.options;
    return side === "left" || side === "right" ? this.dialogEl.offsetWidth : this.dialogEl.offsetHeight;
  }
}
