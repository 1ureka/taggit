import { invalidateAll } from "$app/navigation";
import { api } from "$lib/ui/request.js";
import type { Tag } from "$lib/database";

/**
 * SettingsHiddenTags 的配置選項
 */
type SettingsHiddenTagsOptions = {
  /** 全庫標籤（含 hidden／未使用），authoring 通道，由 page data 提供 */
  authoringTags: Tag[];
};

/**
 * SettingsHiddenTags 的互動邏輯
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
    this.hiddenTags = $derived(this.options.authoringTags.filter((f) => f.meta.hidden).map((f) => f.name));
    this.selectedName = $derived(this.selectedTags[0] ?? "");
    this.selectedHidden = $derived(
      this.options.authoringTags.find((f) => f.name === this.selectedName)?.meta.hidden ?? false,
    );
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
    const res = await api.patch(`/api/tags/${encodeURIComponent(name)}`, { hidden: next });

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
