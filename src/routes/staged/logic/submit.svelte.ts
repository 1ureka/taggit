/**
 * @file submit.svelte.ts
 * 把 drafts 目前生效的內容組成批次提交，送出後清掉成功項目、回報失敗項目
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { getDraftsContext } from "./drafts.svelte";

/** TODO: 原型端點以 `filename` 為鍵，committed 端點卻是 `id`；端點轉正時應統一 */
type StagedBatchItem = { filename: string; name: string; tags: string[]; rating: number };

class SubmitController {
  private drafts = getDraftsContext();

  /** 是否有一次提交正在進行中 */
  pending = $state(false);
  /** 上一次提交後的失敗匯總（filename -> 原因） */
  lastFailures = $state<Record<string, string>>({});

  /** 名稱留空時由 `nameOf` 補上去副檔名的檔名 */
  private buildItem(filename: string): StagedBatchItem {
    const draft = this.drafts.viewOf(filename);
    return { filename, name: this.drafts.nameOf(filename), tags: draft.tags, rating: draft.rating };
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
      const items = filenames.map((f) => this.buildItem(f));
      const res = await api.post<{ results: { filename: string; ok: boolean; error?: string }[] }>(
        "/api/proto/staged-batch",
        { items },
      );
      if (!res.ok) throw new Error(res.error);

      const failures = new Map<string, string>();
      for (const r of res.data.results) if (!r.ok) failures.set(r.filename, r.error ?? "未知錯誤");
      this.lastFailures = Object.fromEntries(failures);

      const succeeded = filenames.filter((f) => !failures.has(f));
      this.drafts.handleDiscardDraft(succeeded);

      if (succeeded.length > 0) addToast({ message: `已提交 ${succeeded.length} 張圖片`, variant: "success" });
      if (failures.size > 0) addToast({ message: `${failures.size} 張提交失敗`, variant: "error" });

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
