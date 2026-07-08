import type { TagFacet } from "$lib/database/client.js";
import { scrollToActive } from "$lib/components/dom";

/**
 * 自動補全組件的配置選項
 */
type AutocompleteOptions = {
  /** 雙向綁定：目前選中的標籤列表 */
  get selectedTags(): string[];
  set selectedTags(value: string[]);
  /** 候選標籤來源（通常為 page data 的 facets，由 SSR 提供） */
  get candidates(): TagFacet[];
  /** 當標籤變更時觸發 */
  onchange?: () => void;
  /** 選項元素的高度 */
  get itemHeight(): number;
};

/**
 * 自動補全組件的互動邏輯。
 * 候選標籤由建構端注入（SSR faceted search 的資料流），本類別無任何網路副作用。
 */
export class Autocomplete {
  /** 輸入框實例的引用 (DOM) */
  inputEl = $state<HTMLInputElement>();
  /** 選項的滾動容器的引用 (DOM) */
  scrollContainer = $state<HTMLElement>();
  /** 下拉選單是否顯示的狀態 */
  showDropdown = $state(false);

  /** 輸入框當前的文字內容 */
  inputValue = $state("");
  /** 下拉選單中目前高亮選項的索引 */
  activeIndex = $state(-1);

  /** 顯示在下拉選單中的標籤列表 */
  dropdownTags: TagFacet[];
  /** 同時顯示的標籤數量 */
  maxVisibleTags = 100;

  constructor(private options: AutocompleteOptions) {
    this.dropdownTags = $derived.by(() => {
      const query = this.inputValue.trim().toLowerCase();
      const excluded = new Set(this.options.selectedTags);
      const available = this.options.candidates.filter((t) => !excluded.has(t.name));
      if (!query) return available.slice(0, this.maxVisibleTags);
      return available.filter((t) => t.name.toLowerCase().includes(query)).slice(0, this.maxVisibleTags);
    });
  }

  // ---

  /** 切換目前高亮選項的索引 */
  #setActiveIndex(index: number) {
    if (index < -1 || index >= this.dropdownTags.length) return;
    this.activeIndex = index;

    if (index < 0 || !this.scrollContainer) return;
    scrollToActive(this.scrollContainer, index, this.options.itemHeight);
  }

  /** 將標籤加入已選列表（支援以逗號分隔的多個標籤） */
  #addTag(name: string) {
    const normalized = name.trim();
    if (!normalized) return;

    const inputTags = normalized
      .split(/[,，]+/)
      .map((t) => t.trim())
      .filter((t) => t)
      .filter((t) => !this.options.selectedTags.includes(t));

    const uniqueInputTags = Array.from(new Set(inputTags));

    if (uniqueInputTags.length === 0) return;

    this.options.selectedTags = [...this.options.selectedTags, ...uniqueInputTags];
    this.options.onchange?.();

    this.inputValue = "";
    this.#setActiveIndex(-1);
    this.inputEl?.focus();
  }

  /** 從已選列表中移除指定的標籤 */
  #removeTag(name: string) {
    this.options.selectedTags = this.options.selectedTags.filter((t) => t !== name);
    this.options.onchange?.();
  }

  /** 從已選列表中移除最後一個標籤 */
  #popTag() {
    if (this.options.selectedTags.length === 0) return;
    this.options.selectedTags = this.options.selectedTags.slice(0, -1);
    this.options.onchange?.();
  }

  // ---

  /** 開啟下拉選單 */
  #openDropdown() {
    this.showDropdown = true;
    this.#setActiveIndex(-1);
  }

  /** 關閉下拉選單並重置高亮索引 */
  #closeDropdown() {
    this.showDropdown = false;
    this.#setActiveIndex(-1);
  }

  // ---

  /** 處理 input 輸入事件：若選單未顯示則開啟，並重置高亮索引 */
  handleInput = () => {
    if (!this.showDropdown) this.#openDropdown();
    this.#setActiveIndex(-1);
  };

  /** 處理 input 聚焦事件：若選單未顯示則開啟 */
  handleInputFocus = () => {
    if (!this.showDropdown) this.#openDropdown();
  };

  /** 處理 input 失焦事件：關閉下拉選單 */
  handleInputBlur = () => {
    this.#addTag(this.inputValue); // 嘗試將輸入框內容作為標籤加入（如果有的話）
    this.#closeDropdown();
  };

  /** 處理 input 鍵盤事件：根據按鍵執行相應操作 */
  handleInputKeydown = (e: KeyboardEvent) => {
    /** 當按下 Escape 鍵且下拉選單顯示時，關閉下拉選單 */
    if (e.key === "Escape" && this.showDropdown) {
      e.stopPropagation();
      this.#closeDropdown();
      return;
    }

    /** 當按下 Backspace 鍵且輸入框為空時，刪除最後一個標籤 */
    if (e.key === "Backspace" && !this.inputValue) {
      this.#popTag();
      return;
    }

    /** 當按下 ArrowDown 鍵時，若下拉選單未顯示則打開下拉選單；若下拉選單已顯示則將高亮移動到下一個標籤 (阻止瀏覽器滾動頁面) */
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!this.showDropdown) {
        this.#openDropdown();
        return;
      }
      this.#setActiveIndex(Math.min(this.activeIndex + 1, this.dropdownTags.length - 1));
      return;
    }

    /** 當按下 ArrowUp 鍵時，若下拉選單未顯示則打開下拉選單；若下拉選單已顯示則將高亮移動到上一個標籤 (阻止瀏覽器滾動頁面) */
    if (e.key === "ArrowUp" && this.showDropdown) {
      e.preventDefault();
      this.#setActiveIndex(Math.max(this.activeIndex - 1, 0));
      return;
    }

    /** 當按下 Enter 鍵時，若有高亮標籤則選中該標籤；若輸入框有內容則新增標籤 */
    if (e.key === "Enter") {
      e.preventDefault();

      if (this.activeIndex >= 0 && this.activeIndex < this.dropdownTags.length) {
        this.#addTag(this.dropdownTags[this.activeIndex].name);
      } else if (this.inputValue.trim()) {
        this.#addTag(this.inputValue.trim());
      }
    }
  };

  // ---

  /** 處理 chip 點擊事件：從已選列表中移除對應標籤 */
  handleChipClick = (name: string) => {
    this.#removeTag(name);
  };

  // ---

  /** 處理 dropdown 鼠標按下事件：選中對應標籤並阻止 input 失去焦點 */
  handleDropdownMouseDown = (e: MouseEvent, tag: TagFacet) => {
    e.preventDefault(); // 阻止 input 失去焦點，從而保持 dropdown 打開
    this.#addTag(tag.name);
  };

  /** 處理 dropdown 鼠標移入事件：更新高亮索引 */
  handleDropdownMouseOver = (index: number) => {
    this.#setActiveIndex(index);
  };
}
