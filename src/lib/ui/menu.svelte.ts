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
 * 浮動選單的互動邏輯（與 Select 的差異：適用於導航跳轉、單次操作收納等場景）
 */
export class Menu {
  /** 觸發器按鈕實例的引用 (DOM) */
  triggerEl = $state<HTMLButtonElement>();
  /** 選單是否開啟 */
  open = $state(false);
  /** 選單中目前「虛擬聚焦」的項目索引 */
  activeIndex = $state(-1);

  constructor(private options: MenuOptions) {
    // 當 list 動態縮減時自動夾緊 activeIndex；list 歸零時自動關閉選單
    $effect(() => {
      const len = this.options.list.length;
      if (len === 0) {
        this.open = false;
        this.activeIndex = -1;
      } else if (this.activeIndex >= len) {
        this.activeIndex = len - 1;
      }
    });
  }

  // ---

  get list() {
    return this.options.list;
  }

  // ---

  #openMenu() {
    this.open = true;
    this.activeIndex = -1;
  }

  #closeMenu() {
    this.open = false;
    this.activeIndex = -1;
  }

  #selectItem(item: MenuItem) {
    this.options.onselect?.(item);
    if (!this.options.disableAutoClose) {
      this.#closeMenu();
    }
  }

  // ---

  /** 處理 Trigger 點擊事件，切換選單的開啟/關閉狀態 */
  handleTriggerClick = () => {
    if (this.open) {
      this.#closeMenu();
    } else {
      this.#openMenu();
    }
  };

  /** 處理 Trigger 失焦事件，關閉選單 */
  handleTriggerBlur = () => {
    this.#closeMenu();
  };

  /** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
  handleTriggerKeydown = (e: KeyboardEvent) => {
    /** 選單關閉時，按下特定鍵開啟 */
    if (!this.open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        this.#openMenu();
      }
      return;
    }

    /** 選單開啟時的導航邏輯 */
    switch (e.key) {
      case "Escape":
        this.#closeMenu();
        break;

      case "Tab":
        // 若尚未到最後一個項目，攔截 Tab 用來切換虛擬聚焦
        if (this.activeIndex < this.options.list.length - 1) {
          e.preventDefault();
          this.activeIndex = Math.min(this.activeIndex + 1, this.options.list.length - 1);
        }
        // 已在最後一個時不攔截，讓瀏覽器自然讓 trigger 失焦 → blur → #closeMenu()
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
          this.#selectItem(this.options.list[this.activeIndex]);
        } else {
          this.#closeMenu();
        }
        break;
    }
  };

  // ---

  /** 處理選單項目滑鼠按下事件（阻止 trigger 失焦） */
  handleItemMouseDown = (e: MouseEvent, item: MenuItem) => {
    e.preventDefault();
    this.#selectItem(item);
  };

  /** 處理選單項目滑鼠移入事件，更新虛擬聚焦索引 */
  handleItemMouseEnter = (index: number) => {
    this.activeIndex = index;
  };
}
