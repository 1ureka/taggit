type ComboOptions = {
  /** 雙向綁定：輸入框當前文字（即時，非 commit 後才變） */
  value: string;
  /** 這一刻要顯示的候選 key 清單——篩選/查詢邏輯完全由呼叫端決定 */
  candidates: readonly string[];
  /** 是否允許把不在 candidates 裡的文字當作有效值 commit */
  allowCustomValue: boolean;
  /** 每次 commit（挑候選 / 接受自訂輸入 / blur）時觸發 */
  onchange?: (value: string) => void;
};

/**
 * Combo 的互動邏輯：候選導覽 + commit 判定。
 */
export class Combo {
  /** 輸入框實例的引用 (DOM) */
  inputEl = $state<HTMLInputElement>();
  /** 下拉選單是否開啟 */
  open = $state(false);
  /** 下拉選單中目前「虛擬聚焦」的候選索引 */
  activeIndex = $state(-1);

  constructor(private options: ComboOptions) {}

  // ---

  /** 把最終決定的字串 commit 成 value，觸發 onchange，並關閉下拉 */
  #commit(next: string) {
    this.options.value = next;
    this.options.onchange?.(next);
    this.#closeDropdown();
  }

  /** 根據目前狀態（有沒有虛擬聚焦的候選、allowCustomValue）決定要 commit 什麼 */
  #commitFromState() {
    if (this.activeIndex >= 0 && this.activeIndex < this.options.candidates.length) {
      this.#commit(this.options.candidates[this.activeIndex]);
      return;
    }
    if (this.options.allowCustomValue) {
      this.#commit(this.options.value);
      return;
    }
    if (!this.options.candidates.includes(this.options.value)) {
      this.#commit("");
      return;
    }
    this.#closeDropdown();
  }

  #openDropdown() {
    this.open = true;
    this.activeIndex = -1;
  }

  #closeDropdown() {
    this.open = false;
    this.activeIndex = -1;
  }

  #moveActive(delta: 1 | -1) {
    const count = this.options.candidates.length;
    if (count === 0) return;
    this.activeIndex =
      this.activeIndex < 0 ? (delta > 0 ? 0 : count - 1) : Math.min(Math.max(this.activeIndex + delta, 0), count - 1);
  }

  // ---

  /** 處理輸入事件：有新字元進來，舊的虛擬聚焦位置已經沒意義，重置 */
  handleInput = () => {
    if (!this.open) this.#openDropdown();
    this.activeIndex = -1;
  };

  handleInputClick = () => {
    if (!this.open) this.#openDropdown();
    this.activeIndex = -1;
  };

  handleFocus = () => {
    if (!this.open) this.#openDropdown();
  };

  handleBlur = () => {
    this.#commitFromState();
  };

  handleKeydown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        if (this.open) {
          e.stopPropagation();
          this.#closeDropdown();
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        if (!this.open) {
          this.#openDropdown();
        } else {
          this.#moveActive(1);
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (!this.open) {
          this.#openDropdown();
        } else {
          this.#moveActive(-1);
        }
        break;

      case "Enter":
        e.preventDefault();
        this.#commitFromState();
        break;
    }
  };

  // ---

  /** 處理候選項點擊 */
  handleCandidateMouseDown = (e: MouseEvent, key: string) => {
    e.preventDefault();
    this.#commit(key);
  };

  handleCandidateMouseEnter = (index: number) => {
    this.activeIndex = index;
  };
}
