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
 * 建立 Modal 對話框邏輯的核心工廠函數
 */
export function createModal(options: ModalOptions) {
  /** Modal 對話框容器的引用 (DOM) */
  let dialogEl = $state<HTMLDivElement>();

  /** 開啟前持有焦點的元素引用 */
  let previouslyFocused: HTMLElement | null = null;

  // ---

  /** 可聚焦元素的 CSS 選擇器 */
  const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  // ---

  /** 儲存當前焦點並將焦點移入 Modal 內第一個可操作元素 */
  function saveFocusAndTrap() {
    previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      dialogEl?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });
  }

  /** 還原開啟前持有焦點的元素 */
  function restoreFocus() {
    previouslyFocused?.focus();
    previouslyFocused = null;
  }

  // ---

  /** 處理 Overlay 點擊事件，點擊背景關閉 Modal */
  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) options.onclose();
  }

  /** 處理 Overlay 鍵盤事件，Escape 關閉與 Tab focus trap */
  function handleOverlayKeydown(e: KeyboardEvent) {
    /** 當按下 Escape 鍵時，消費事件並關閉 Modal */
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      options.onclose();
      return;
    }

    /** 當按下 Tab 鍵時，將焦點限制在 Modal 內部循環 */
    if (e.key === "Tab" && dialogEl) {
      const focusable = dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
  }

  // ---

  /** 監聽 open 狀態變化，開啟時儲存焦點並啟用 trap，關閉時還原焦點 */
  $effect(() => {
    if (options.open) {
      saveFocusAndTrap();
      return () => restoreFocus();
    }
  });

  // ---

  return {
    /** 獲取 Modal 對話框容器的 getter */
    get dialogEl() {
      return dialogEl as HTMLDivElement;
    },
    /** 設定 Modal 對話框容器的 setter */
    set dialogEl(el: HTMLDivElement) {
      dialogEl = el;
    },

    /** 處理 Overlay 點擊事件，點擊背景關閉 Modal */
    handleOverlayClick,
    /** 處理 Overlay 鍵盤事件，Escape 關閉與 Tab focus trap */
    handleOverlayKeydown,
  };
}
