import { api } from "$lib/utils/client.js";
import { getCollectionPathHistory, pushCollectionPathHistory } from "$lib/collection/client.js";
import { clearCollectionPathHistory } from "$lib/collection/client.js";

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

  /** 曾成功設定過的路徑歷史（最近優先） */
  history = $state<string[]>([]);
  /**
   * 目前瀏覽到的歷史索引；`-1` 表示未在瀏覽歷史（顯示的是使用者當下輸入）。
   */
  historyIndex = $state(-1);
  /** 進入歷史瀏覽前，暫存使用者當下輸入，供 ArrowDown 越過最新一筆時還原。 */
  #draft = "";

  constructor(options: SettingsCollectionOptions) {
    this.inputValue = options.collectionRoot;
    this.history = getCollectionPathHistory();
  }

  // ---

  /** 輸入框下方的提示文字 */
  get historyHint(): string {
    if (this.history.length === 0) return "尚無使用紀錄";
    if (this.historyIndex >= 0) return `第 ${this.historyIndex + 1}/${this.history.length} 筆歷史紀錄`;
    return `可用 ↑ / ↓ 切換歷史路徑（共 ${this.history.length} 筆）`;
  }

  /** 套用指定索引的歷史路徑至輸入框 */
  #applyHistory(index: number) {
    this.historyIndex = index;
    this.inputValue = this.history[index];
  }

  // ---

  /** 處理輸入框鍵盤事件，以上下鍵瀏覽歷史路徑 */
  handleInputKeydown = (e: KeyboardEvent) => {
    if (this.history.length === 0) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      // 從當下輸入進入歷史時，先暫存草稿以便日後還原
      if (this.historyIndex === -1) this.#draft = this.inputValue;
      this.#applyHistory(Math.min(this.historyIndex + 1, this.history.length - 1));
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.historyIndex <= -1) return;
      if (this.historyIndex === 0) {
        // 越過最新一筆，還原使用者原本的輸入
        this.historyIndex = -1;
        this.inputValue = this.#draft;
        return;
      }
      this.#applyHistory(this.historyIndex - 1);
    }
  };

  /** 使用者手動編輯輸入框時，脫離歷史瀏覽狀態 */
  handleInput = () => {
    this.historyIndex = -1;
  };

  /** 清空歷史路徑紀錄 */
  handleClearHistoryClick = () => {
    clearCollectionPathHistory();
    this.history = [];
    this.historyIndex = -1;
  };

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
      this.history = pushCollectionPathHistory(this.inputValue.trim());
      window.location.href = "/settings";
    } else {
      this.isError = true;
      this.message = res.error ?? "未知錯誤";
    }
  };
}
