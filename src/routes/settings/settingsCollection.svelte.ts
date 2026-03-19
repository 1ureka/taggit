import { api } from "$lib/client/api.js";

/**
 * SettingsCollection 的配置選項
 */
type SettingsCollectionOptions = {
  /** 唯讀：圖片集根目錄 */
  collectionRoot: string;
};

/**
 * SettingsCollection 的互動邏輯
 */
export class SettingsCollection {
  /** 路徑輸入框的值 */
  inputValue = $state("");
  /** 是否正在儲存 */
  saving = $state(false);
  /** 儲存結果訊息 */
  message = $state("");
  /** 訊息是否為錯誤 */
  isError = $state(false);

  constructor(options: SettingsCollectionOptions) {
    this.inputValue = options.collectionRoot;
  }

  // ---

  /** 處理表單 submit 事件，驗證並儲存圖片集路徑 */
  handleFormSubmit = async (e: Event) => {
    e.preventDefault();
    if (this.saving) return;

    this.saving = true;
    this.message = "";
    this.isError = false;

    const res = await api.post("/api/settings/setup", { collectionRoot: this.inputValue.trim() });
    this.saving = false;

    if (res.ok) {
      this.message = "儲存成功";
      this.isError = false;
      window.location.href = "/settings";
    } else {
      this.isError = true;
      this.message = res.error ?? "未知錯誤";
    }
  };
}
