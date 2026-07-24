/**
 * @file metadata.svelte.ts
 * 元資料完整性檢查與補算
 */

import { getContext, setContext } from "svelte";
import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

class MetadataController {
  /** 缺失元資料的圖片數量（-1 表示尚未檢查） */
  missing = $state(-1);
  /** 是否正在檢查或修復中 */
  pending = $state(false);

  /** 缺失元資料的圖片結果 */
  result = $derived.by(() => {
    if (this.missing < 0) return undefined;
    if (this.missing === 0) return "所有圖片的元資料皆完整";
    return `找到 ${this.missing} 張圖片缺少元資料`;
  });

  /** 處理檢查事件 */
  handleCheck = async () => {
    if (this.pending) return;
    this.pending = true;

    try {
      const res = await api.get<{ missing: number }>("/api/settings/metadata");

      if (!res.ok) {
        // TODO: 修復 $lib/utils/request 而不是這裡
        addToast({ message: `檢查失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
        return;
      }

      // TODO: 修復 $lib/utils/request 而不是這裡
      this.missing = res.data.missing;
    } catch (err) {
      addToast({ message: "檢查失敗：" + formatError(err), variant: "error" });
    } finally {
      this.pending = false;
    }
  };

  /** 處理請求修復事件 */
  handleFix = async () => {
    if (this.pending) return;
    this.pending = true;

    try {
      const res = await api.post<{ updated: number }>("/api/settings/metadata");

      if (!res.ok) {
        // TODO: 修復 $lib/utils/request 而不是這裡
        addToast({ message: `補算失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
        return;
      }

      // TODO: 修復 $lib/utils/request 而不是這裡
      const { updated } = res.data;
      const message = updated > 0 ? `已為 ${updated} 張圖片補上元資料` : "沒有圖片需要補算";
      addToast({ message, variant: "success" });
    } catch (err) {
      addToast({ message: "修補失敗：" + formatError(err), variant: "error" });
    } finally {
      this.pending = false;
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
