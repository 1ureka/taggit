/**
 * @file metadata.svelte.ts
 * 元資料完整性檢查 + 補算
 */

import { getContext, setContext } from "svelte";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";

class MetadataController {
  /** 缺失元資料的圖片數量（-1 表示尚未檢查） */
  missing = $state(-1);
  checking = $state(false);
  fixing = $state(false);

  busy = $derived(this.checking || this.fixing);

  /** 檢查結果需持續可見（驅動「補算」按鈕），留在卡片內 */
  result = $derived.by(() => {
    if (this.missing < 0) return undefined;
    if (this.missing === 0) return "所有圖片的元資料皆完整";
    return `找到 ${this.missing} 張圖片缺少元資料`;
  });

  private check = async () => {
    try {
      const res = await api.get<{ missing: number }>("/api/settings/metadata");
      if (res.ok && res.data) {
        this.missing = res.data.missing;
      } else {
        addToast({ message: `檢查失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
      }
    } catch (err) {
      addToast({ message: "檢查失敗" + (err instanceof Error ? `：${err.message}` : ""), variant: "error" });
    }
  };

  handleCheck = async () => {
    if (this.busy) return;
    this.checking = true;
    await this.check();
    this.checking = false;
  };

  handleFix = async () => {
    if (this.busy) return;
    this.fixing = true;

    try {
      const res = await api.post<{ updated: number }>("/api/settings/metadata");
      if (res.ok && res.data) {
        const { updated } = res.data;
        addToast({
          message: updated > 0 ? `已為 ${updated} 張圖片補上元資料` : "沒有圖片需要補算",
          variant: "success",
        });
        // 補算期間可能有新圖片被提交，重新查詢一次取得真實的最新缺失數，不用樂觀估計
        await this.check();
      } else {
        addToast({ message: `補算失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
      }
    } catch (err) {
      addToast({ message: "補算失敗" + (err instanceof Error ? `：${err.message}` : ""), variant: "error" });
    } finally {
      this.fixing = false;
    }
  };
}

const key = Symbol("metadata-controller");

export const createMetadataContext = () => {
  const controller = new MetadataController();
  setContext(key, controller);
  return controller;
};

export const getMetadataContext = () => getContext<MetadataController>(key);
