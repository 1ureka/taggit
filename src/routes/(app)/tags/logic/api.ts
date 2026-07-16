/**
 * @file api.ts
 * /tags 的伺服器往來：變更集預覽（tags-preview）與批次送出（tags-batch）。
 */

import { api } from "$lib/utils/request";
import type { Changeset, ChangesetPreview } from "$lib/query-spec";
import { renameKey, deleteKey, hiddenKey, type TagChangeset } from "./changeset";

/** 變更集轉為 tags-preview / tags-batch 共用的 body 形狀 */
function toPayload(cs: TagChangeset, included?: Set<string>): Changeset {
  const want = (key: string) => included === undefined || included.has(key);
  return {
    deletes: cs.deletes.filter((n) => want(deleteKey(n))),
    renames: Object.entries(cs.renames)
      .filter(([from]) => want(renameKey(from)))
      .map(([from, to]) => ({ from, to })),
    hidden: Object.entries(cs.hidden)
      .filter(([name]) => want(hiddenKey(name)))
      .map(([name, hidden]) => ({ name, hidden })),
  };
}

/** 取得變更集的套用前預覽。傳輸層錯誤直接 throw。 */
export async function fetchProjection(cs: TagChangeset): Promise<ChangesetPreview> {
  const res = await api.post<ChangesetPreview>("/api/proto/tags-preview", toPayload(cs));
  if (!res.ok || !res.data) throw new Error(res.error || "預覽失敗");
  return res.data;
}

// ---

type OpResult = { key: string; ok: boolean; error?: string };

/**
 * 送出變更集中 keys 指定的子集合。
 * 回傳失敗操作的 `key -> 錯誤訊息` 對映（全部成功時為空）。
 * 傳輸層錯誤直接 throw。
 */
export async function submitChangeset(cs: TagChangeset, keys: string[]): Promise<Map<string, string>> {
  const res = await api.post<{ results: OpResult[] }>("/api/proto/tags-batch", toPayload(cs, new Set(keys)));
  if (!res.ok || !res.data) throw new Error(res.error || "送出失敗");

  const failures = new Map<string, string>();
  for (const r of res.data.results) {
    if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
  }
  return failures;
}
