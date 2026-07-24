/**
 * @file changeset.ts
 * TODO: 重新思考職責與正確位置
 */

import { api } from "$lib/utils/request";
import type { ScheduleState } from "./schedule.svelte";

/** TODO: 淘汰原本非常不好的 api 後，這裡可能也得重寫 */
type ChangesetPayload = {
  deletes: string[];
  renames: { from: string; to: string }[];
  hidden: { name: string; hidden: boolean }[];
};

/** TODO: 即將淘汰或重寫 */
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

/** TODO: 即將淘汰或重寫 */
type OpResult = { key: string; ok: boolean; error?: string };

/** TODO: 即將淘汰或重寫 */
export async function submitChangeset(state: ScheduleState, names: string[]): Promise<Map<string, string>> {
  const res = await api.post<{ results: OpResult[] }>("/api/proto/tags-batch", toPayload(state, new Set(names)));
  if (!res.ok) throw new Error(res.error);

  const failures = new Map<string, string>();
  for (const r of res.data.results) if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
  return failures;
}
