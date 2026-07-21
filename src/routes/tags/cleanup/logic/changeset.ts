/**
 * @file changeset.ts
 * /tags/cleanup 的送出：把目前排程狀態轉為 tags-batch 的 body 並呼叫。
 */

import { api } from "$lib/utils/request";
import type { ScheduleState } from "./schedule.svelte";

/** tags-batch 送出的 body 形狀 */
type ChangesetPayload = {
  deletes: string[];
  renames: { from: string; to: string }[];
  hidden: { name: string; hidden: boolean }[];
};

/** 排程狀態轉為 tags-batch 的 body 形狀，`included` 用操作對象的標籤名稱篩選子集合 */
function toPayload(state: ScheduleState, included: Set<string>): ChangesetPayload {
  const want = (name: string) => included.has(name);
  return {
    deletes: Object.keys(state.deletes).filter(want),
    renames: Object.entries(state.renames)
      .filter(([from]) => want(from))
      .map(([from, m]) => ({ from, to: m.to })),
    hidden: Object.keys(state.hidden)
      .filter(want)
      .map((name) => ({ name, hidden: true })),
  };
}

/** key 是操作對象的標籤名稱，見 `api/proto/tags-batch/+server.ts` 的 OpResult 註解 */
type OpResult = { key: string; ok: boolean; error?: string };

/**
 * 送出排程狀態中 names 指定的子集合。
 * 回傳失敗操作的 `name -> 錯誤訊息` 對映（全部成功時為空）。
 * 傳輸層錯誤直接 throw。
 */
export async function submitChangeset(state: ScheduleState, names: string[]): Promise<Map<string, string>> {
  const res = await api.post<{ results: OpResult[] }>("/api/proto/tags-batch", toPayload(state, new Set(names)));
  if (!res.ok || !res.data) throw new Error(res.error || "送出失敗");

  const failures = new Map<string, string>();
  for (const r of res.data.results) if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
  return failures;
}
