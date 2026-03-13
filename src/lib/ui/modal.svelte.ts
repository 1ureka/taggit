/**
 * Modal 對話框組件的配置選項
 */
type ModalOptions = {
  /** 雙向綁定：Modal 是否開啟 */
  open: boolean;
  /** 當 Modal 關閉時觸發的回調 */
  onclose: () => void;
};

/**
 * Modal 對話框的無頭 UI
 */
export class Modal {
  /** Modal 對話框容器的引用 (DOM) */
  dialogEl = $state<HTMLDivElement>();

  #previouslyFocused: HTMLElement | null = null;
  #FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  constructor(private options: ModalOptions) {
    $effect(() => {
      if (this.options.open) {
        this.#saveFocusAndTrap();
        return () => this.#restoreFocus();
      }
    });
  }

  // ---

  #saveFocusAndTrap() {
    this.#previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      this.dialogEl?.querySelector<HTMLElement>(this.#FOCUSABLE_SELECTOR)?.focus();
    });
  }

  #restoreFocus() {
    this.#previouslyFocused?.focus();
    this.#previouslyFocused = null;
  }

  // ---

  /** 處理 Overlay 點擊事件，點擊背景關閉 Modal */
  handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) this.options.onclose();
  };

  /** 處理 Overlay 鍵盤事件，Escape 關閉與 Tab focus trap */
  handleOverlayKeydown = (e: KeyboardEvent) => {
    /** 當按下 Escape 鍵時，消費事件並關閉 Modal */
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.options.onclose();
      return;
    }

    /** 當按下 Tab 鍵時，將焦點限制在 Modal 內部循環 */
    if (e.key === "Tab" && this.dialogEl) {
      const focusable = this.dialogEl.querySelectorAll<HTMLElement>(this.#FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
}
