import type { TagInfo } from "$lib/types.js";
import { tagCache } from "$lib/client/cache.js";

/**
 * 自動補全組件的配置選項
 */
type AutocompleteOptions = {
  /** 雙向綁定：目前選中的標籤列表 */
  selectedTags: string[];
  /** 當標籤變更時觸發 */
  onchange?: () => void;
  /** 空輸入時按 Enter 觸發（非新增標籤行為）。可用於比如「提交」等外部動作 */
  onenter?: () => void;
};

/**
 * 自動補全組件的互動邏輯
 */
export class Autocomplete {
  /** 輸入框實例的引用 (DOM) */
  inputEl = $state<HTMLInputElement>();
  /** 下拉選單是否顯示的狀態 */
  showDropdown = $state(false);

  /** 輸入框當前的文字內容 */
  inputValue = $state("");
  /** 下拉選單中目前高亮選項的索引 */
  activeIndex = $state(-1);

  /** 從快取中獲取的所有原始標籤數據 */
  tags = $state<TagInfo[]>([]);
  /** 顯示在下拉選單中的標籤列表 */
  dropdownTags: TagInfo[];

  constructor(private options: AutocompleteOptions) {
    this.dropdownTags = $derived.by(() => {
      const query = this.inputValue.trim().toLowerCase();
      const excluded = new Set(this.options.selectedTags.map((t) => t.toLowerCase()));
      const available = this.tags.filter((t) => !excluded.has(t.name.toLowerCase()));
      if (!query) return available;
      return available.filter((t) => t.name.toLowerCase().includes(query));
    });
  }

  // ---

  /** 將標籤加入已選列表（支援以逗號分隔的多個標籤） */
  #addTag(name: string) {
    const normalized = name.trim().toLowerCase();
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
    this.activeIndex = -1;
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

  /** 開啟下拉選單並從快取載入標籤數據 */
  async #openDropdown() {
    this.tags = await tagCache.get(); // 這會自己請求去重、使用快取、並在後台更新等
    this.showDropdown = true;
    this.activeIndex = -1;
  }

  /** 關閉下拉選單並重置高亮索引 */
  #closeDropdown() {
    this.showDropdown = false;
    this.activeIndex = -1;
  }

  // ---

  /** 處理 input 輸入事件：若選單未顯示則開啟，並重置高亮索引 */
  handleInput = () => {
    if (!this.showDropdown) this.#openDropdown();
    this.activeIndex = -1;
  };

  /** 處理 input 聚焦事件：若選單未顯示則開啟 */
  handleInputFocus = () => {
    if (!this.showDropdown) this.#openDropdown();
  };

  /** 處理 input 失焦事件：關閉下拉選單 */
  handleInputBlur = () => {
    this.#closeDropdown();
  };

  /** 處理 input 鍵盤事件：根據按鍵執行相應操作 */
  handleInputKeydown = (e: KeyboardEvent) => {
    /** 當按下 Escape 鍵且下拉選單顯示時，關閉下拉選單 */
    if (e.key === "Escape" && this.showDropdown) {
      this.#closeDropdown();
      return;
    }

    /** 當按下 Backspace 鍵且輸入框為空時，刪除最後一個標籤 */
    if (e.key === "Backspace" && !this.inputValue) {
      this.#popTag();
      return;
    }

    /** 當按下 Tab 鍵且下拉選單顯示時，選中當前高亮的標籤 (觸發時阻止瀏覽器將焦點移動到下一個可聚焦元素) */
    if (e.key === "Tab" && this.showDropdown && this.dropdownTags.length > 0) {
      e.preventDefault();
      const idx = this.activeIndex >= 0 ? this.activeIndex : 0;
      this.#addTag(this.dropdownTags[idx].name);
      return;
    }

    /** 當按下 ArrowDown 鍵時，若下拉選單未顯示則打開下拉選單；若下拉選單已顯示則將高亮移動到下一個標籤 (阻止瀏覽器滾動頁面) */
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!this.showDropdown) {
        this.#openDropdown();
        return;
      }
      this.activeIndex = Math.min(this.activeIndex + 1, this.dropdownTags.length - 1);
      return;
    }

    /** 當按下 ArrowUp 鍵時，若下拉選單未顯示則打開下拉選單；若下拉選單已顯示則將高亮移動到上一個標籤 (阻止瀏覽器滾動頁面) */
    if (e.key === "ArrowUp" && this.showDropdown) {
      e.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      return;
    }

    /** 當按下 Enter 鍵時，若有高亮標籤則選中該標籤；若輸入框有內容則新增標籤；否則觸發 onenter 回調 (阻止瀏覽器提交表單) */
    if (e.key === "Enter") {
      e.preventDefault();

      if (this.activeIndex >= 0 && this.activeIndex < this.dropdownTags.length) {
        this.#addTag(this.dropdownTags[this.activeIndex].name);
        return;
      }

      if (this.inputValue.trim()) {
        this.#addTag(this.inputValue.trim());
        return;
      }

      this.options.onenter?.();
      return;
    }
  };

  // ---

  /** 處理 chip 點擊事件：從已選列表中移除對應標籤 */
  handleChipClick = (name: string) => {
    this.#removeTag(name);
  };

  // ---

  /** 處理 dropdown 鼠標按下事件：選中對應標籤並阻止 input 失去焦點 */
  handleDropdownMouseDown = (e: MouseEvent, tag: TagInfo) => {
    e.preventDefault(); // 阻止 input 失去焦點，從而保持 dropdown 打開
    this.#addTag(tag.name);
  };

  /** 處理 dropdown 鼠標移入事件：更新高亮索引 */
  handleDropdownMouseOver = (index: number) => {
    this.activeIndex = index;
  };
}
