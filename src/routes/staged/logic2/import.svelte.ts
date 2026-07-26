/**
 * @file import.svelte.ts
 * 匯入紀錄對話框的開闔、即時進度與結果
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { addToast } from "$lib/components/floating/toast-events";
import { formatError, isRecord } from "$lib/utils/shared";

import { importRecords, type ImportProgress, type ImportResult } from "./import-api";

class ImportController {
  /** 匯入對話框是否開啟 */
  open = $state(false);
  /** 是否有一次匯入正在進行中 */
  pending = $state(false);
  /** 匯入中的即時進度，尚未開始或已結束時為 null */
  progress = $state<ImportProgress | null>(null);
  /** 上一次匯入完成後的結果摘要，尚未匯入或已重置時為 null */
  result = $state<ImportResult | null>(null);

  /** 開啟匯入對話框 */
  handleOpen = () => {
    this.progress = null;
    this.result = null;
    this.open = true;
  };

  /** 關閉匯入對話框，匯入進行中時不允許關閉 */
  handleClose = () => {
    if (this.pending) return;
    this.open = false;
    this.progress = null;
    this.result = null;
  };

  /** 解析並匯入所選的 JSON 檔案 */
  handleImportFile = async (file: File) => {
    if (this.pending) return;

    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isRecord(parsed) || Object.keys(parsed).length === 0) {
        addToast({ message: "JSON 必須是非空的物件", variant: "error" });
        return;
      }
      payload = parsed;
    } catch {
      addToast({ message: "無法解析 JSON 檔案", variant: "error" });
      return;
    }

    this.pending = true;
    this.progress = { current: 0, total: Object.keys(payload).length };
    try {
      this.result = await importRecords(payload, (p) => (this.progress = p));
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      this.result = { imported: 0, skipped: 0, errors: [formatError(e)] };
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("import-controller");

export const createImportContext = () => {
  const controller = new ImportController();
  setContext(key, controller);
  return controller;
};

export const getImportContext = () => getContext<ImportController>(key);
