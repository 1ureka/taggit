import { invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { requestConfirm } from "$lib/components/dom.js";

/**
 * 標籤操作結果
 */
type TagActionResult =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "conflict"; tagName: string };

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
  /** 操作結果 */
  result = $state<TagActionResult | null>(null);

  /** 舊標籤名稱 */
  oldName: string;
  /** 是否可提交 */
  canSubmit: boolean;

  constructor() {
    this.oldName = $derived(this.selectedTags[0] ?? "");
    this.canSubmit = $derived.by(() => {
      const trimOld = this.oldName.trim();
      const trimNew = this.newName.trim();

      if (!trimOld || this.busy) return false;
      if (trimNew === trimOld) return false;
      return true;
    });
  }

  // ---

  async #doRename() {
    const trimOld = this.oldName.trim();
    const trimNew = this.newName.trim();
    if (!trimOld || !trimNew || trimOld === trimNew) return;

    this.busy = true;
    this.result = null;

    const res = await api.post<{ affected: number }>("/api/tags", { oldName: trimOld, newName: trimNew });

    if (res.ok && res.data) {
      const message = `已將「${trimOld}」重命名為「${trimNew}」，影響 ${res.data.affected} 張圖片`;
      this.result = { type: "success", message };
      this.selectedTags = [];
      this.newName = "";
      await invalidateAll();
    } else {
      this.result = { type: "error", message: res.error || "未知錯誤" };
    }

    this.busy = false;
  }

  async #doDelete() {
    const trimOld = this.oldName.trim();
    if (!trimOld) return;

    const message = `確定要刪除標籤「${trimOld}」嗎？此操作無法復原。`;
    const confirmed = await requestConfirm(message, { title: "刪除標籤", action: "刪除" });
    if (!confirmed) return;

    this.busy = true;
    this.result = null;

    const res = await api.del<{ affected: number }>("/api/tags", { name: trimOld });

    if (res.ok) {
      this.result = { type: "success", message: `已刪除標籤「${trimOld}」` };
      this.selectedTags = [];
      await invalidateAll();
    } else if (res.status === 409) {
      this.result = { type: "conflict", tagName: trimOld };
    } else {
      this.result = { type: "error", message: res.error || "未知錯誤" };
    }

    this.busy = false;
  }

  // ---

  /** 處理標籤選取變更事件，只保留最後一個並聚焦新名稱輸入框 */
  handleSelectChange = () => {
    if (this.selectedTags.length > 1) this.selectedTags = [this.selectedTags.at(-1)!];
    if (this.oldName) requestAnimationFrame(() => this.newInputEl?.focus());
  };

  /** 處理重命名按鈕點擊事件，新名稱留空時視作刪除 */
  handleRenameClick = () => {
    if (this.newName.trim()) {
      this.#doRename();
    } else {
      this.#doDelete();
    }
  };

  // ---

  /** 處理新名稱輸入框 keydown 事件，Enter 提交重命名 */
  handleNewNameKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.#doRename();
    }
  };
}
