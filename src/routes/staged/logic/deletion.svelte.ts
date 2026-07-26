/**
 * @file deletion.svelte.ts
 * 永久刪除單張暫存檔案，刪除後把編輯指標移到相鄰的下一張
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

import { getPageDataContext } from "./page-data.svelte";
import { getPointersContext } from "./pointers.svelte";
import { getDraftsContext } from "./drafts.svelte";

class DeletionController {
  private pageData = getPageDataContext();
  private pointers = getPointersContext();
  private drafts = getDraftsContext();

  /** 是否有一次刪除正在進行中 */
  pending = $state(false);

  /** 永久刪除指定檔案，刪除為單次行為 */
  handleDelete = async (filename: string) => {
    if (this.pending) return;

    const msg = `確定要永久刪除 ${filename}？此操作無法復原。`;
    if (!(await requestConfirm(msg, { title: "永久刪除", action: "永久刪除" }))) return;

    // 鄰居必須於重跑 load 之前計算
    const files = this.pageData.value.stagedFiles;
    const index = files.indexOf(filename);
    const next = files[index + 1] ?? files[index - 1] ?? null;

    this.pending = true;
    try {
      const res = await api.del(`/api/staged/${encodeURIComponent(filename)}`);
      if (!res.ok) {
        addToast({ message: `刪除失敗: ${res.error}`, variant: "error" });
        return;
      }

      this.drafts.handleDiscardDraft([filename]);
      if (next !== null) this.pointers.handleSelect(next);
      else this.pointers.handleClose();

      addToast({ message: `已永久刪除：${filename}`, variant: "info" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: `刪除失敗: ${formatError(e)}`, variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("deletion-controller");

export const createDeletionContext = () => {
  const controller = new DeletionController();
  setContext(key, controller);
  return controller;
};

export const getDeletionContext = () => getContext<DeletionController>(key);
