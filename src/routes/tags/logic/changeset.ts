/**
 * @file changeset.ts
 * TODO: 重新思考職責與正確位置
 */

import { api } from "$lib/utils/request";
import type { BoardOperation } from "./board.svelte";

/** 變更集 */
type TagChangeset = {
  /** 重新命名 from -> to；多個 from 指向同一個 to 即為合併 */
  renames: Record<string, string>;
  /** 待刪除的標籤（會自所有圖片移除） */
  deletes: string[];
  /** 待取消隱藏或隱藏的標籤 */
  hidden: Record<string, boolean>;
};

/** 由標籤異動操作推導變更集 */
function changesetFromOperations(ops: BoardOperation[]): TagChangeset {
  const cs: TagChangeset = { renames: {}, deletes: [], hidden: {} };

  for (const op of ops) {
    if (op.kind === "rename" || op.kind === "merge") cs.renames[op.name] = op.to;
    else if (op.kind === "delete") cs.deletes.push(op.name);
    else cs.hidden[op.name] = op.kind === "hidden";
  }

  return cs;
}

/** TODO: 淘汰原本非常不好的 api 後，這裡可能也得重寫 */
type ChangesetPayload = {
  deletes: string[];
  renames: { from: string; to: string }[];
  hidden: { name: string; hidden: boolean }[];
};

/** TODO: 即將淘汰或重寫 */
function toPayload(cs: TagChangeset, included: Set<string>): ChangesetPayload {
  const want = (name: string) => included.has(name);

  return {
    deletes: cs.deletes.filter(want),
    renames: Object.entries(cs.renames)
      .filter(([from]) => want(from))
      .map(([from, to]) => ({ from, to })),
    hidden: Object.entries(cs.hidden)
      .filter(([name]) => want(name))
      .map(([name, hidden]) => ({ name, hidden })),
  };
}

/** 即將淘汰（見 `api/proto/tags-batch/+server.ts` 的 OpResult 註解） */
type OpResult = { key: string; ok: boolean; error?: string };

/** TODO: 即將淘汰或重寫 */
export async function submitChangeset(ops: BoardOperation[], names: string[]): Promise<Map<string, string>> {
  const cs = changesetFromOperations(ops);
  const res = await api.post<{ results: OpResult[] }>("/api/proto/tags-batch", toPayload(cs, new Set(names)));
  if (!res.ok || !res.data) throw new Error(res.error || "送出失敗");

  const failures = new Map<string, string>();
  for (const r of res.data.results) {
    if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
  }
  return failures;
}
