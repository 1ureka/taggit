/**
 * @file changeset.ts
 * /tags 的本地變更集模型：畫布（合併堆／刪除區／顯隱切換區）推導出宣告式變更集，
 * 加上純本地驗證與審查條目組裝。伺服器端的預估（合併後張數、清空警告、逐標籤現況）
 * 來自 `POST /api/proto/tags-preview`（見 `./api.ts`），在此與本地變更集拼成審查條目。
 */

import type { Tag } from "$lib/database";
import type { ChangesetPreview } from "$lib/query-spec";

/** 合併堆：members 全部改名為 canonical（canonical 自身除外） */
export type MergeGroup = {
  id: number;
  canonical: string;
  members: Tag[];
};

/**
 * 宣告式變更集。同一標籤同時只能有一種操作（畫布的單一位置保證互斥）。
 */
export type TagChangeset = {
  /** 重新命名 from -> to；多個 from 指向同一個 to 即為合併 */
  renames: Record<string, string>;
  /** 待刪除的標籤（會自所有圖片移除） */
  deletes: string[];
  /** 顯隱覆寫 name -> 目標 hidden 值 */
  hidden: Record<string, boolean>;
};

/** 由畫布狀態推導變更集 */
export function changesetFromBoard(groups: MergeGroup[], deleteList: Tag[], toggleList: Tag[]): TagChangeset {
  const cs: TagChangeset = { renames: {}, deletes: [], hidden: {} };
  for (const g of groups) {
    const canonical = g.canonical.trim();
    for (const m of g.members) if (m.name !== canonical) cs.renames[m.name] = canonical;
  }
  cs.deletes = deleteList.map((t) => t.name);
  for (const t of toggleList) cs.hidden[t.name] = !t.meta.hidden;
  return cs;
}

/** 變更集內的操作總數 */
export function changesetSize(cs: TagChangeset): number {
  return Object.keys(cs.renames).length + cs.deletes.length + Object.keys(cs.hidden).length;
}

/** 前端即時驗證：標籤名稱是否合法（與後端 Validator.tagName 一致） */
export function isValidTagName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 50 && !value.includes(",");
}

// ─── 操作 key（審查 modal 的勾選 / 失敗對映用識別碼，與 tags-batch 的回應 key 對齊）───

export const renameKey = (from: string) => `rename:${from}`;
export const deleteKey = (name: string) => `delete:${name}`;
export const hiddenKey = (name: string) => `hidden:${name}`;

// ─── 審查條目 ───

/** 審查 modal 的一筆待送出操作 */
export type ChangeEntry = {
  key: string;
  kind: "rename" | "delete" | "hidden";
  /** 操作對象（rename 時為 from） */
  name: string;
  /** 對象的使用數（有預覽時為最新值，否則為畫布上的 Tag 值） */
  count: number;
  /** rename 目標 */
  to?: string;
  /** rename 是否為合併（目標已存在、或另一個 rename 也指向它） */
  merge?: boolean;
  /** 合併後目標的預估張數（來自預覽端點） */
  mergedCount?: number;
  /** hidden 操作的目標值 */
  hidden?: boolean;
  /** 不可送出的原因（null = 可送出） */
  problem: string | null;
};

/**
 * 由變更集組審查條目。純本地可判的問題（名稱不合法、rename 互指、目標被排入刪除）
 * 不等預覽；存在性與清空警告等需要後端現況的檢查在 projection 到位後補上。
 */
export function changesetEntries(
  cs: TagChangeset,
  tagOf: (name: string) => Tag | undefined,
  projection: ChangesetPreview | null,
): ChangeEntry[] {
  const deletes = new Set(cs.deletes);
  const renameTargets = new Map<string, number>();
  for (const to of Object.values(cs.renames)) renameTargets.set(to, (renameTargets.get(to) ?? 0) + 1);

  const status = (name: string) => projection?.tags[name];
  const countOf = (name: string) => status(name)?.count ?? tagOf(name)?.count ?? 0;

  const entries: ChangeEntry[] = [];

  for (const [from, to] of Object.entries(cs.renames)) {
    let problem: string | null = null;
    if (!isValidTagName(to)) problem = "新名稱不合法（1–50 字元、不可含逗號）";
    else if (cs.renames[to] !== undefined) problem = `目標「${to}」本身也被排入重新命名`;
    else if (deletes.has(to)) problem = `目標「${to}」已被排入刪除`;
    else if (status(from)?.exists === false) problem = `「${from}」已不存在，可能已被外部操作改動`;

    const isMerge = (status(to)?.exists ?? false) || (renameTargets.get(to) ?? 0) > 1;
    entries.push({
      key: renameKey(from),
      kind: "rename",
      name: from,
      count: countOf(from),
      to,
      merge: isMerge,
      mergedCount: projection?.mergedCounts[to],
      problem,
    });
  }

  for (const name of cs.deletes) {
    let problem: string | null = null;
    const emptied = projection?.emptiedBy[name] ?? 0;
    if (status(name)?.exists === false) problem = `「${name}」已不存在，可能已被外部操作改動`;
    else if (emptied > 0) problem = `有 ${emptied} 張圖片會因此失去最後一個標籤`;
    entries.push({ key: deleteKey(name), kind: "delete", name, count: countOf(name), problem });
  }

  for (const [name, hidden] of Object.entries(cs.hidden)) {
    let problem: string | null = null;
    if (cs.renames[name] !== undefined) problem = `「${name}」已被排入重新命名，請對新名稱設定顯隱`;
    else if (status(name)?.exists === false) problem = `「${name}」已不存在，可能已被外部操作改動`;
    entries.push({ key: hiddenKey(name), kind: "hidden", name, count: countOf(name), hidden, problem });
  }

  return entries;
}
