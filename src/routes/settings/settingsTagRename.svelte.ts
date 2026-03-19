import { api } from "$lib/client/api.js";
import { tagCache } from "$lib/client/cache.js";

/**
 * SettingsTagRename 的互動邏輯
 */
export class SettingsTagRename {
  /** 選中的舊標籤 */
  selectedTags = $state<string[]>([]);
  /** 新標籤名稱 */
  newName = $state("");
  /** 新名稱輸入框 DOM 引用 */
  newInputEl = $state<HTMLInputElement>();
  /** 是否正在處理 */
  busy = $state(false);
  /** 操作結果訊息 */
  result = $state("");
  /** 結果是否為錯誤 */
  resultIsError = $state(false);

  /** 舊標籤名稱 */
  oldName: string;
  /** 是否可提交 */
  canSubmit: boolean;

  constructor() {
    this.oldName = $derived(this.selectedTags[0] ?? "");
    this.canSubmit = $derived(
      !!this.oldName.trim() &&
        !!this.newName.trim() &&
        this.oldName.trim().toLowerCase() !== this.newName.trim().toLowerCase() &&
        !this.busy,
    );
  }

  // ---

  async #doRename() {
    if (!this.canSubmit) return;

    const trimOld = this.oldName.trim().toLowerCase();
    const trimNew = this.newName.trim().toLowerCase();
    if (!trimOld || !trimNew || trimOld === trimNew) return;

    this.busy = true;
    this.result = "";
    this.resultIsError = false;

    const res = await api.post<{ affected: number }>("/api/tags", {
      oldName: trimOld,
      newName: trimNew,
    });

    if (res.ok && res.data) {
      this.result = `已將「${trimOld}」重命名為「${trimNew}」，影響 ${res.data.affected} 張圖片`;
      this.resultIsError = false;
      tagCache.invalidate();
      this.selectedTags = [];
      this.newName = "";
    } else {
      this.result = "錯誤: " + (res.error || "未知");
      this.resultIsError = true;
    }
    this.busy = false;
  }

  // ---

  /** 處理標籤選取變更事件，只保留最後一個並聚焦新名稱輸入框 */
  handleSelectChange = () => {
    if (this.selectedTags.length > 1) this.selectedTags = [this.selectedTags.at(-1)!];
    if (this.oldName) requestAnimationFrame(() => this.newInputEl?.focus());
  };

  /** 處理重命名按鈕點擊事件 */
  handleRenameClick = () => {
    this.#doRename();
  };

  // ---

  /** 處理新名稱輸入框 keydown 事件，Enter 提交 */
  handleNewNameKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.#doRename();
    }
  };
}
