import { invalidateAll } from "$app/navigation";
import { api } from "$lib/utils/client.js";
import type { TagFacet } from "$lib/database/client.js";

/**
 * SettingsHiddenTags 的配置選項
 */
type SettingsHiddenTagsOptions = {
  /** 全庫標籤 facets（含 hidden 標記），由 page data 提供 */
  facets: TagFacet[];
};

/**
 * SettingsHiddenTags 的互動邏輯
 *
 * 隱藏標籤的資料模型（TagMeta.hidden）、讀寫端點（PATCH /api/tags）與查詢遮蔽
 * 皆已於 database 模組實作；本類別只負責設定頁的挑選與切換互動。
 */
export class SettingsHiddenTags {
  /** 選中的標籤（只保留一個） */
  selectedTags = $state<string[]>([]);
  /** 是否正在處理 */
  busy = $state(false);
  /** 操作結果訊息 */
  message = $state("");
  /** 訊息是否為錯誤 */
  isError = $state(false);

  /** 目前被標記為隱藏的標籤名稱清單 */
  hiddenTags: string[];
  /** 選中的標籤名稱 */
  selectedName: string;
  /** 選中標籤目前是否為隱藏 */
  selectedHidden: boolean;
  /** 是否可提交 */
  canSubmit: boolean;

  constructor(private options: SettingsHiddenTagsOptions) {
    this.hiddenTags = $derived(this.options.facets.filter((f) => f.hidden).map((f) => f.name));
    this.selectedName = $derived(this.selectedTags[0] ?? "");
    this.selectedHidden = $derived(this.options.facets.find((f) => f.name === this.selectedName)?.hidden ?? false);
    this.canSubmit = $derived(!!this.selectedName.trim() && !this.busy);
  }

  // ---

  /** 處理標籤選取變更事件，只保留最後一個 */
  handleSelectChange = () => {
    if (this.selectedTags.length > 1) this.selectedTags = [this.selectedTags.at(-1)!];
  };

  /** 切換選中標籤的隱藏狀態 */
  handleToggleClick = async () => {
    const name = this.selectedName.trim();
    if (!name || this.busy) return;

    this.busy = true;
    this.message = "";
    this.isError = false;

    const next = !this.selectedHidden;
    const res = await api.patch("/api/tags", { name, hidden: next });

    if (res.ok) {
      this.message = next ? `已將「${name}」設為隱藏` : `已取消隱藏「${name}」`;
      this.isError = false;
      this.selectedTags = [];
      await invalidateAll();
    } else {
      this.isError = true;
      this.message = res.error ?? "未知錯誤";
    }

    this.busy = false;
  };
}
