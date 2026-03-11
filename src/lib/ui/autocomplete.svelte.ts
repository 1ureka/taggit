import type { TagInfo } from "$lib/types.js";
import { tagCache } from "$lib/client/cache";

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
 * 建立自動補全邏輯的核心工廠函數
 */
export function createAutocomplete(options: AutocompleteOptions) {
  /** 輸入框實例的引用 (DOM) */
  let inputEl = $state<HTMLInputElement>();
  /** 下拉選單是否顯示的狀態 */
  let showDropdown = $state(false);

  /** 輸入框當前的文字內容 */
  let inputValue = $state("");
  /** 下拉選單中目前高亮選項的索引 */
  let activeIndex = $state(-1);

  // ---

  /** 從快取中獲取的所有原始標籤數據 */
  let tags = $state<TagInfo[]>([]);
  /** 顯示在下拉選單中的標籤列表 */
  let dropdownTags = $derived.by(() => {
    const query = inputValue.trim().toLowerCase();
    const excluded = new Set(options.selectedTags.map((t) => t.toLowerCase()));
    const available = tags.filter((t) => !excluded.has(t.name.toLowerCase()));
    if (!query) return available;
    return available.filter((t) => t.name.toLowerCase().includes(query));
  });

  // ---

  /** 將標籤加入已選列表（支援以逗號分隔的多個標籤） */
  function addTag(name: string) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;

    const inputTags = normalized
      .split(/[,，]+/)
      .map((t) => t.trim())
      .filter((t) => t)
      .filter((t) => !options.selectedTags.includes(t));

    const uniqueInputTags = Array.from(new Set(inputTags));

    if (uniqueInputTags.length === 0) return;

    options.selectedTags = [...options.selectedTags, ...uniqueInputTags];
    options.onchange?.();

    inputValue = "";
    activeIndex = -1;
    inputEl?.focus();
  }

  /** 從已選列表中移除指定的標籤 */
  function removeTag(name: string) {
    options.selectedTags = options.selectedTags.filter((t) => t !== name);
    options.onchange?.();
  }

  /** 從已選列表中移除最後一個標籤 */
  function popTag() {
    if (options.selectedTags.length === 0) return;
    options.selectedTags = options.selectedTags.slice(0, -1);
    options.onchange?.();
  }

  // ---

  /** 開啟下拉選單並從快取載入標籤數據 */
  async function openDropdown() {
    tags = await tagCache.get(); // 這會自己請求去重、使用快取、並在後台更新等
    showDropdown = true;
    activeIndex = -1;
  }

  /** 關閉下拉選單並重置高亮索引 */
  function closeDropdown() {
    showDropdown = false;
    activeIndex = -1;
  }

  // ---

  /** 處理 input 輸入事件：若選單未顯示則開啟，並重置高亮索引 */
  function handleInput() {
    if (!showDropdown) openDropdown();
    activeIndex = -1;
  }

  /** 處理 input 聚焦事件：若選單未顯示則開啟 */
  function handleInputFocus() {
    if (!showDropdown) openDropdown();
  }

  /** 處理 input 失焦事件：關閉下拉選單 */
  function handleInputBlur() {
    closeDropdown();
  }

  /** 處理 input 鍵盤事件：根據按鍵執行相應操作 */
  function handleInputKeydown(e: KeyboardEvent) {
    /** 當按下 Escape 鍵且下拉選單顯示時，關閉下拉選單 */
    if (e.key === "Escape" && showDropdown) {
      closeDropdown();
      return;
    }

    /** 當按下 Backspace 鍵且輸入框為空時，刪除最後一個標籤 */
    if (e.key === "Backspace" && !inputValue) {
      popTag();
      return;
    }

    /** 當按下 Tab 鍵且下拉選單顯示時，選中當前高亮的標籤 (觸發時阻止瀏覽器將焦點移動到下一個可聚焦元素) */
    if (e.key === "Tab" && showDropdown && dropdownTags.length > 0) {
      e.preventDefault();

      const idx = activeIndex >= 0 ? activeIndex : 0;
      addTag(dropdownTags[idx].name);
      return;
    }

    /** 當按下 ArrowDown 鍵時，若下拉選單未顯示則打開下拉選單；若下拉選單已顯示則將高亮移動到下一個標籤 (阻止瀏覽器滾動頁面) */
    if (e.key === "ArrowDown") {
      e.preventDefault();

      if (!showDropdown) {
        openDropdown();
        return;
      }

      activeIndex = Math.min(activeIndex + 1, dropdownTags.length - 1);
      return;
    }

    /** 當按下 ArrowUp 鍵時，若下拉選單未顯示則打開下拉選單；若下拉選單已顯示則將高亮移動到上一個標籤 (阻止瀏覽器滾動頁面) */
    if (e.key === "ArrowUp" && showDropdown) {
      e.preventDefault();

      activeIndex = Math.max(activeIndex - 1, 0);
      return;
    }

    /** 當按下 Enter 鍵時，若有高亮標籤則選中該標籤；若輸入框有內容則新增標籤；否則觸發 onenter 回調 (阻止瀏覽器提交表單) */
    if (e.key === "Enter") {
      e.preventDefault();

      if (activeIndex >= 0 && activeIndex < dropdownTags.length) {
        addTag(dropdownTags[activeIndex].name);
        return;
      }

      if (inputValue.trim()) {
        addTag(inputValue.trim());
        return;
      }

      options.onenter?.();
      return;
    }
  }

  // ---

  /** 處理 chip 點擊事件：從已選列表中移除對應標籤 */
  function handleChipClick(name: string) {
    removeTag(name);
  }

  // ---

  /** 處理 dropdown 鼠標按下事件：選中對應標籤並阻止 input 失去焦點 */
  function handleDropdownMouseDown(e: MouseEvent, tag: TagInfo) {
    e.preventDefault(); // 阻止 input 失去焦點，從而保持 dropdown 打開
    addTag(tag.name);
  }

  /** 處理 dropdown 鼠標移入事件：更新高亮索引 */
  function handleDropdownMouseOver(index: number) {
    activeIndex = index;
  }

  // ---

  return {
    /** 獲取輸入框元素的 getter */
    get inputEl() {
      return inputEl as HTMLInputElement;
    },
    /** 設置輸入框元素的 setter */
    set inputEl(el: HTMLInputElement) {
      inputEl = el;
    },

    /** 獲取下拉選單顯示狀態的 getter */
    get showDropdown() {
      return showDropdown;
    },

    /** 獲取輸入框值的 getter */
    get inputValue() {
      return inputValue;
    },
    /** 設置輸入框值的 setter */
    set inputValue(value: string) {
      inputValue = value;
    },

    /** 獲取下拉選單高亮索引的 getter */
    get activeIndex() {
      return activeIndex;
    },

    /** 獲取下拉選單標籤的 getter */
    get dropdownTags() {
      return dropdownTags;
    },

    /** 處理 input 輸入事件：若選單未顯示則開啟，並重置高亮索引 */
    handleInput,
    /** 處理 input 聚焦事件：若選單未顯示則開啟 */
    handleInputFocus,
    /** 處理 input 失焦事件：關閉下拉選單 */
    handleInputBlur,
    /** 處理 input 鍵盤事件：根據按鍵執行相應操作 */
    handleInputKeydown,

    /** 處理 chip 點擊事件：從已選列表中移除對應標籤 */
    handleChipClick,

    /** 處理 dropdown 鼠標按下事件：選中對應標籤並阻止 input 失去焦點 */
    handleDropdownMouseDown,
    /** 處理 dropdown 鼠標移入事件：更新高亮索引 */
    handleDropdownMouseOver,
  };
}
