/**
 * @file submit.svelte.ts
 * 把 drafts/reverts 目前生效的內容組成批次提交，送出後清掉成功項目、回報失敗項目
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";
import { getSnapshotsContext } from "./snapshots.svelte";

type CommittedBatchItem =
  | { id: string; op?: "update"; name?: string; tags?: string[]; rating?: number; expectedUpdatedAt: number }
  | { id: string; op: "revert" };

class SubmitController {
  private drafts = getDraftsContext();
  private reverts = getRevertMarkContext();
  private snapshots = getSnapshotsContext();

  /** 是否有一次提交正在進行中 */
  pending = $state(false);
  /** 上一次提交後的失敗匯總（filename -> 原因） */
  lastFailures = $state<Record<string, string>>({});

  /** 標記為退回的優先於編輯草稿——即使兩者剛好同時存在，送出時以退回為準 */
  private buildItem(filename: string): CommittedBatchItem {
    if (this.reverts.isMarked(filename)) return { id: filename, op: "revert" };

    const draft = this.drafts.viewOf(filename);
    const snapshot = this.snapshots.peek(filename);
    return {
      id: filename,
      name: draft.name.trim(),
      tags: draft.tags,
      rating: draft.rating,
      expectedUpdatedAt: snapshot.updatedAt,
    };
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
      const res = await api.post<{ results: { id: string; ok: boolean; error?: string }[] }>(
        "/api/proto/committed-batch",
        { items },
      );
      if (!res.ok || !res.data) throw new Error(res.error || "提交失敗");

      const failures = new Map<string, string>();
      for (const r of res.data.results) if (!r.ok) failures.set(r.id, r.error ?? "未知錯誤");
      this.lastFailures = Object.fromEntries(failures);

      const succeeded = filenames.filter((f) => !failures.has(f));
      this.drafts.handleDiscardDraft(succeeded);
      this.reverts.handleUnmark(succeeded);

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
