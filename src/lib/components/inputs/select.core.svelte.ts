type SelectOptions = {
  /** 雙向綁定：目前選中的 key */
  value: string | undefined;
  /** 選項 key 列表 */
  list: readonly string[];
  /** 當選項變更時觸發的回調 */
  onchange?: (key: string) => void;
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

  constructor(private options: SelectOptions) {}

  // ---

  #selectOption(key: string) {
    this.options.value = key;
    this.options.onchange?.(key);
    this.#closeDropdown();
  }

  #openDropdown() {
    this.open = true;
    this.activeIndex = this.options.value !== undefined ? this.options.list.indexOf(this.options.value) : -1;
  }

  #closeDropdown() {
    this.open = false;
    this.activeIndex = -1;
  }

  // ---

  handleTriggerClick = () => {
    if (this.open) {
      this.#closeDropdown();
    } else {
      this.#openDropdown();
    }
  };

  handleTriggerBlur = () => {
    this.#closeDropdown();
  };

  handleTriggerKeydown = (e: KeyboardEvent) => {
    // 選單關閉時，特定按鍵負責開啟它
    if (!this.open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        this.#openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        this.#closeDropdown();
        break;

      case "Tab":
        // 還沒到最後一個選項時攔截 Tab 用來切換虛擬聚焦，已在最後一個則放行讓瀏覽器自然 blur
        if (this.activeIndex < this.options.list.length - 1) {
          e.preventDefault();
          this.activeIndex = Math.min(this.activeIndex + 1, this.options.list.length - 1);
        }
        break;

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

  handleOptionMouseDown = (e: MouseEvent, key: string) => {
    e.preventDefault();
    this.#selectOption(key);
  };

  handleOptionMouseEnter = (index: number) => {
    this.activeIndex = index;
  };
}
