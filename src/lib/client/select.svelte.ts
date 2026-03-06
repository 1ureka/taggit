/**
 * 選項單元格式
 */
export type SelectItem = { value: string | number | undefined; label: string };

/**
 * 下拉選單組件的配置選項
 */
type SelectOptions = {
  /** 雙向綁定：目前選中的值 */
  value: string | number | undefined;
  /** 選項列表 */
  list: SelectItem[];
  /** 當選項變更時觸發的回調 */
  onchange?: (value: string | number | undefined) => void;
};

/**
 * 建立下拉選單邏輯的核心工廠函數
 */
export function createSelect(options: SelectOptions) {
  /** 觸發器按鈕實例的引用 (DOM) */
  let triggerEl = $state<HTMLButtonElement>();
  /** 下拉選單是否開啟 */
  let open = $state(false);

  /** 下拉選單中目前「虛擬聚焦」的選項索引 */
  let activeIndex = $state(-1);

  /** 根據目前 options.value 找到對應的 label */
  const selectedLabel = $derived(options.list.find((item) => item.value === options.value)?.label ?? "");

  // ---

  /** 執行選取動作 */
  function selectOption(item: SelectItem) {
    options.value = item.value;
    options.onchange?.(item.value);
    closeDropdown();
  }

  /** 開啟選單，預設虛擬聚焦到當前已選中的那一個，若無則為 -1 */
  function openDropdown() {
    open = true;
    activeIndex = options.list.findIndex(({ value }) => value === options.value);
  }

  /** 關閉選單，重置虛擬聚焦索引 */
  function closeDropdown() {
    open = false;
    activeIndex = -1;
  }

  // ---

  /** 處理 Trigger 點擊事件，切換下拉選單的開啟/關閉狀態 */
  function handleTriggerClick() {
    if (open) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  /** 處理 Trigger 失焦事件，關閉下拉選單 */
  function handleTriggerBlur() {
    closeDropdown();
  }

  /** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
  function handleTriggerKeydown(e: KeyboardEvent) {
    /** 如果選單關閉中，按下特定鍵開啟它 */
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openDropdown();
      }
      return; // 代表若沒早退，下方邏輯只會在選單開啟時執行
    }

    /** 選單開啟時的導航邏輯 */
    switch (e.key) {
      case "Escape":
        closeDropdown();
        break;

      case "Tab":
        // 如果還沒到最後一個選項，攔截 Tab 用來切換虛擬聚焦
        if (activeIndex < options.list.length - 1) {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, options.list.length - 1);
        }
        break; // 如果已經在最後一個，不執行阻止，瀏覽器會自然讓 trigger 失焦，進而觸發 blur -> closeDropdown()

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
          selectOption(options.list[activeIndex]);
        } else {
          closeDropdown();
        }
        break;
    }
  }

  // ---

  /** 處理 selectItem 點擊事件 */
  function handleOptionMouseDown(e: MouseEvent, item: SelectItem) {
    e.preventDefault();
    selectOption(item);
  }

  /** 處理 selectItem 滑鼠移入事件，更新虛擬聚焦索引 */
  function handleOptionMouseEnter(index: number) {
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

    /** 存取下拉選單狀態的 getter */
    get open() {
      return open;
    },
    /** 存取虛擬聚焦索引的 getter */
    get activeIndex() {
      return activeIndex;
    },
    /** 存取目前選中的標籤的 getter */
    get selectedLabel() {
      return selectedLabel;
    },

    /** 處理 Trigger 點擊事件，切換下拉選單的開啟/關閉狀態 */
    handleTriggerClick,
    /** 處理 Trigger 失焦事件，關閉下拉選單 */
    handleTriggerBlur,
    /** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
    handleTriggerKeydown,

    /** 處理 selectItem 點擊事件 */
    handleOptionMouseDown,
    /** 處理 selectItem 滑鼠移入事件 */
    handleOptionMouseEnter,
  };
}
