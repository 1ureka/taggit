/**
 * @file submit.svelte.ts
 * 把 drafts 目前生效的內容組成批次提交，送出後清掉成功項目、回報失敗項目
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { api, type BatchResults } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { getDraftsContext } from "./drafts.svelte";

/** 端點以檔名為鍵，值就是這一筆要建立的紀錄內容 */
type CommitEntry = { name: string; tags: string[]; rating: number };

class SubmitController {
  private drafts = getDraftsContext();

  /** 是否有一次提交正在進行中 */
  pending = $state(false);
  /** 上一次提交後的失敗匯總（filename -> 原因） */
  lastFailures = $state<Record<string, string>>({});

  /** 名稱留空時由 `nameOf` 補上去副檔名的檔名 */
  private buildEntry(filename: string): CommitEntry {
    const draft = this.drafts.viewOf(filename);
    return { name: this.drafts.nameOf(filename), tags: draft.tags, rating: draft.rating };
  }

  /** 清掉上一輪的失敗匯總 */
  clearFailures = () => {
    this.lastFailures = {};
  };

  /** 批次提交指定檔名目前生效的內容 */
  handleSubmit = async (filenames: string[]) => {
    if (filenames.length === 0 || this.pending) return;

    this.pending = true;
    try {
      const payload = Object.fromEntries(filenames.map((f) => [f, this.buildEntry(f)]));
      const res = await api.post<BatchResults>("/api/records", payload);
      if (!res.ok) throw new Error(res.error);

      const failures: Record<string, string> = {};
      for (const [id, r] of Object.entries(res.data)) if (!r.ok) failures[id] = r.message;
      this.lastFailures = failures;

      const failedCount = Object.keys(failures).length;
      const succeeded = filenames.filter((f) => !(f in failures));
      this.drafts.handleDiscardDraft(succeeded);

      if (succeeded.length > 0) addToast({ message: `已提交 ${succeeded.length} 張圖片`, variant: "success" });
      if (failedCount > 0) addToast({ message: `${failedCount} 張提交失敗`, variant: "error" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("submit-controller");

export const createSubmitContext = () => {
  const controller = new SubmitController();
  setContext(key, controller);
  return controller;
};

export const getSubmitContext = () => getContext<SubmitController>(key);
