/**
 * SelectCheckbox 的配置選項
 */
type SelectCheckboxOptions = {
  /** 唯讀：是否選中 */
  checked: boolean;
  /** 當狀態變更時觸發的回調 */
  onchange?: (checked: boolean) => void;
};

/**
 * SelectCheckbox 的無頭 UI
 */
export class SelectCheckbox {
  constructor(private options: SelectCheckboxOptions) {}

  // ---

  /** 處理點擊事件，阻止冒泡與預設行為後切換選取狀態 */
  handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    this.options.onchange?.(!this.options.checked);
  };
}
