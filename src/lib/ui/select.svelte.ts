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
 * 下拉選單的互動邏輯
 */
export class Select {
  /** 觸發器按鈕實例的引用 (DOM) */
  triggerEl = $state<HTMLButtonElement>();
  /** 下拉選單是否開啟 */
  open = $state(false);
  /** 下拉選單中目前「虛擬聚焦」的選項索引 */
  activeIndex = $state(-1);

  /** 根據目前 options.value 找到對應的 label */
  selectedLabel: string;

  constructor(private options: SelectOptions) {
    this.selectedLabel = $derived(this.options.list.find((item) => item.value === this.options.value)?.label ?? "");
  }

  // ---

  /** 執行選取動作 */
  #selectOption(item: SelectItem) {
    this.options.value = item.value;
    this.options.onchange?.(item.value);
    this.#closeDropdown();
  }

  /** 開啟選單，預設虛擬聚焦到當前已選中的那一個，若無則為 -1 */
  #openDropdown() {
    this.open = true;
    this.activeIndex = this.options.list.findIndex(({ value }) => value === this.options.value);
  }

  /** 關閉選單，重置虛擬聚焦索引 */
  #closeDropdown() {
    this.open = false;
    this.activeIndex = -1;
  }

  // ---

  /** 處理 Trigger 點擊事件，切換下拉選單的開啟/關閉狀態 */
  handleTriggerClick = () => {
    if (this.open) {
      this.#closeDropdown();
    } else {
      this.#openDropdown();
    }
  };

  /** 處理 Trigger 失焦事件，關閉下拉選單 */
  handleTriggerBlur = () => {
    this.#closeDropdown();
  };

  /** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
  handleTriggerKeydown = (e: KeyboardEvent) => {
    /** 如果選單關閉中，按下特定鍵開啟它 */
    if (!this.open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        this.#openDropdown();
      }
      return; // 代表若沒早退，下方邏輯只會在選單開啟時執行
    }

    /** 選單開啟時的導航邏輯 */
    switch (e.key) {
      case "Escape":
        this.#closeDropdown();
        break;

      case "Tab":
        // 如果還沒到最後一個選項，攔截 Tab 用來切換虛擬聚焦
        if (this.activeIndex < this.options.list.length - 1) {
          e.preventDefault();
          this.activeIndex = Math.min(this.activeIndex + 1, this.options.list.length - 1);
        }
        break; // 如果已經在最後一個，不執行阻止，瀏覽器會自然讓 trigger 失焦，進而觸發 blur -> closeDropdown()

      case "ArrowDown":
        e.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, this.options.list.length - 1);
        break;

      case "ArrowUp":
        e.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, 0);
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        if (this.activeIndex >= 0 && this.activeIndex < this.options.list.length) {
          this.#selectOption(this.options.list[this.activeIndex]);
        } else {
          this.#closeDropdown();
        }
        break;
    }
  };

  // ---

  /** 處理 selectItem 點擊事件 */
  handleOptionMouseDown = (e: MouseEvent, item: SelectItem) => {
    e.preventDefault();
    this.#selectOption(item);
  };

  /** 處理 selectItem 滑鼠移入事件，更新虛擬聚焦索引 */
  handleOptionMouseEnter = (index: number) => {
    this.activeIndex = index;
  };
}
