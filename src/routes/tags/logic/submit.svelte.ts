/**
 * @file submit.svelte.ts
 * 把指定的標籤異動送出，成功的消除異動、失敗的匯總回報
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";

import { api, type BatchResults } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { getZonesContext } from "./zones.svelte";
import { getChangesetContext, type TagChange } from "./changeset.svelte";

/**
 * 由異動集組出端點要的請求內容：以標籤名為鍵，`null` 是刪除。
 * 執行順序（刪除 → 改名 → 顯隱）與集合層衝突檢查都在後端，前端只描述「要變成什麼」。
 */
function toPayload(changes: TagChange[]): Record<string, { name: string } | { hidden: boolean } | null> {
  const payload: Record<string, { name: string } | { hidden: boolean } | null> = {};

  for (const c of changes) {
    if (c.kind === "rename" || c.kind === "merge") payload[c.name] = { name: c.to };
    else if (c.kind === "delete") payload[c.name] = null;
    else payload[c.name] = { hidden: c.kind === "hidden" };
  }

  return payload;
}

class SubmitController {
  private changeset = getChangesetContext();
  private zones = getZonesContext();

  /** 是否有一次送出正在進行中 */
  pending = $state(false);
  /** 上一次送出後的失敗匯總（name -> 原因） */
  lastFailures = $state<Record<string, string>>({});

  /** 清掉上一輪的失敗匯總 */
  clearFailures = () => {
    this.lastFailures = {};
  };

  /** 送出指定標籤目前的異動 */
  handleSubmit = async (names: string[]) => {
    if (names.length === 0 || this.pending) return;

    this.pending = true;
    try {
      const wanted = new Set(names);
      const changes = this.changeset.changes.filter((c) => wanted.has(c.name));

      const res = await api.patch<BatchResults>("/api/tags", toPayload(changes));
      if (!res.ok) throw new Error(res.error);

      const failures: Record<string, string> = {};
      for (const [name, r] of Object.entries(res.data)) if (!r.ok) failures[name] = r.message;
      this.lastFailures = failures;

      const failedCount = Object.keys(failures).length;
      const succeeded = names.filter((n) => !(n in failures));
      this.zones.handleDetach(succeeded);

      if (succeeded.length > 0) addToast({ message: `已套用 ${succeeded.length} 筆標籤操作`, variant: "success" });
      if (failedCount > 0) addToast({ message: `${failedCount} 筆操作失敗`, variant: "error" });

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
