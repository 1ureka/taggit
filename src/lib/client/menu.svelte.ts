/**
 * 選單項目格式
 */
export type MenuItem = { value: string; label: string };

/**
 * 選單組件的配置選項
 */
type MenuOptions = {
  /** 選單項目列表 */
  list: MenuItem[];
  /** 當使用者選取某個項目時觸發（不保存狀態，每次都是一次性動作） */
  onselect?: (item: MenuItem) => void;
  /** 是否要在選擇項目後自動關閉選單 */
  disableAutoClose?: boolean;
};

/**
 * 建立浮動選單邏輯的核心工廠函數 (與 createSelect 的差異: 適用於導航跳轉、單次操作收納等場景)
 */
export function createMenu(options: MenuOptions) {
  /** 觸發器按鈕實例的引用 (DOM) */
  let triggerEl = $state<HTMLButtonElement>();
  /** 選單是否開啟 */
  let open = $state(false);
  /** 選單中目前「虛擬聚焦」的項目索引 */
  let activeIndex = $state(-1);

  // 當 list 動態縮減時自動夾緊 activeIndex；list 歸零時自動關閉選單
  $effect(() => {
    const len = options.list.length;
    if (len === 0) {
      open = false;
      activeIndex = -1;
    } else if (activeIndex >= len) {
      activeIndex = len - 1;
    }
  });

  // ---

  /** 開啟選單，虛擬聚焦重置為 -1 */
  function openMenu() {
    open = true;
    activeIndex = -1;
  }

  /** 關閉選單，重置虛擬聚焦索引 */
  function closeMenu() {
    open = false;
    activeIndex = -1;
  }

  /** 執行選取動作：觸發回調並關閉選單 */
  function selectItem(item: MenuItem) {
    options.onselect?.(item);
    if (!options.disableAutoClose) {
      closeMenu();
    }
  }

  // ---

  /** 處理 Trigger 點擊事件，切換選單的開啟/關閉狀態 */
  function handleTriggerClick() {
    if (open) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  /** 處理 Trigger 失焦事件，關閉選單 */
  function handleTriggerBlur() {
    closeMenu();
  }

  /** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
  function handleTriggerKeydown(e: KeyboardEvent) {
    /** 選單關閉時，按下特定鍵開啟 */
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    /** 選單開啟時的導航邏輯 */
    switch (e.key) {
      case "Escape":
        closeMenu();
        break;

      case "Tab":
        // 若尚未到最後一個項目，攔截 Tab 用來切換虛擬聚焦
        if (activeIndex < options.list.length - 1) {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, options.list.length - 1);
        }
        // 已在最後一個時不攔截，讓瀏覽器自然讓 trigger 失焦 → blur → closeMenu()
        break;

      case "ArrowDown":
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.list.length - 1);
        break;

      case "ArrowUp":
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < options.list.length) {
          selectItem(options.list[activeIndex]);
        } else {
          closeMenu();
        }
        break;
    }
  }

  // ---

  /** 處理選單項目滑鼠按下事件（阻止 trigger 失焦） */
  function handleItemMouseDown(e: MouseEvent, item: MenuItem) {
    e.preventDefault();
    selectItem(item);
  }

  /** 處理選單項目滑鼠移入事件，更新虛擬聚焦索引 */
  function handleItemMouseEnter(index: number) {
    activeIndex = index;
  }

  // ---

  return {
    /** 獲取 Trigger 元素的 getter */
    get triggerEl() {
      return triggerEl as HTMLButtonElement;
    },
    /** 設定 Trigger 元素 setter */
    set triggerEl(el: HTMLButtonElement) {
      triggerEl = el;
    },

    /** 存取目前選單項目列表的 getter（響應式傳遞） */
    get list() {
      return options.list;
    },
    /** 存取選單開啟狀態的 getter */
    get open() {
      return open;
    },
    /** 存取虛擬聚焦索引的 getter */
    get activeIndex() {
      return activeIndex;
    },

    /** 處理 Trigger 點擊事件 */
    handleTriggerClick,
    /** 處理 Trigger 失焦事件 */
    handleTriggerBlur,
    /** 處理 Trigger 鍵盤事件 */
    handleTriggerKeydown,

    /** 處理選單項目滑鼠按下事件 */
    handleItemMouseDown,
    /** 處理選單項目滑鼠移入事件 */
    handleItemMouseEnter,
  };
}
