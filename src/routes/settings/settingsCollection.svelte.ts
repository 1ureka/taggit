import { getSettingsContext } from "./context.svelte.js";

/**
 * 建立圖片集路徑設定邏輯的核心工廠函數
 */
export function createSettingsCollection() {
  /** Settings 頁面共享的 Context */
  const ctx = getSettingsContext();

  /** 路徑輸入框的值 */
  let inputValue = $state(ctx.collectionRoot);
  /** 是否正在儲存 */
  let saving = $state(false);
  /** 儲存結果訊息 */
  let message = $state("");
  /** 訊息是否為錯誤 */
  let isError = $state(false);

  // ---

  /** 處理表單 submit 事件，驗證並儲存圖片集路徑 */
  async function handleFormSubmit(e: Event) {
    e.preventDefault();
    saving = true;
    message = "";
    isError = false;

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionRoot: inputValue.trim() }),
    });
    const json = await res.json();
    saving = false;

    if (json.ok) {
      message = "儲存成功";
      isError = false;
      window.location.href = "/settings";
    } else {
      isError = true;
      message = json.error ?? "未知錯誤";
    }
  }

  // ---

  return {
    /** 存取路徑輸入值的 getter */
    get inputValue() {
      return inputValue;
    },
    /** 設定路徑輸入值的 setter */
    set inputValue(v: string) {
      inputValue = v;
    },
    /** 存取儲存狀態的 getter */
    get saving() {
      return saving;
    },
    /** 存取結果訊息的 getter */
    get message() {
      return message;
    },
    /** 存取錯誤狀態的 getter */
    get isError() {
      return isError;
    },
    /** 處理表單 submit 事件，驗證並儲存圖片集路徑 */
    handleFormSubmit,
  };
}
