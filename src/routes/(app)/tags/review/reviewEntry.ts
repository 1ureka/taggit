/**
 * @file reviewEntry.ts
 * 審查清單的資料模型：把變更集（畫布推導）、伺服器預估（合併後張數、清空警告、逐標籤現況）
 * 與頁面旗標（勾選、上次送出失敗原因）拼成一列列可審查的紀錄，並提供全選/全不選。
 */

import type { Tag } from "$lib/database";
import type { ChangesetPreview } from "$lib/query-spec";
import { renameKey, deleteKey, hiddenKey, type TagChangeset } from "../logic/changeset";

/** 前端即時驗證：標籤名稱是否合法（與後端 Validator.tagName 一致） */
export function isValidTagName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 50 && !value.includes(",");
}

/** 審查清單上的一列 */
export type ReviewEntry = {
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
  /** 不可送出的原因，或上次送出失敗的原因（null = 可送出） */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
};

/**
 * 由變更集組審查條目。純本地可判的問題（名稱不合法、rename 互指、目標被排入刪除）
 * 不等預覽；存在性與清空警告等需要後端現況的檢查在 projection 到位後補上；
 * 上次送出失敗的原因（`failures`）與本地問題合併成同一個 `problem` 欄位。
 */
export function buildReviewEntries(
  cs: TagChangeset,
  tagOf: (name: string) => Tag | undefined,
  projection: ChangesetPreview | null,
  checkedKeys: Set<string>,
  failures: Record<string, string>,
): ReviewEntry[] {
  const deletes = new Set(cs.deletes);
  const renameTargets = new Map<string, number>();
  for (const to of Object.values(cs.renames)) renameTargets.set(to, (renameTargets.get(to) ?? 0) + 1);

  const status = (name: string) => projection?.tags[name];
  const countOf = (name: string) => status(name)?.count ?? tagOf(name)?.count ?? 0;

  /** 併入上次送出失敗的原因，並依最終問題推導勾選狀態 */
  const finish = (key: string, problem: string | null) => {
    const failure = failures[key];
    const finalProblem = problem ?? (failure ? `送出失敗：${failure}` : null);
    return { problem: finalProblem, checked: checkedKeys.has(key) && finalProblem === null };
  };

  const entries: ReviewEntry[] = [];

  for (const [from, to] of Object.entries(cs.renames)) {
    let problem: string | null = null;
    if (!isValidTagName(to)) problem = "新名稱不合法（1–50 字元、不可含逗號）";
    else if (cs.renames[to] !== undefined) problem = `目標「${to}」本身也被排入重新命名`;
    else if (deletes.has(to)) problem = `目標「${to}」已被排入刪除`;
    else if (status(from)?.exists === false) problem = `「${from}」已不存在，可能已被外部操作改動`;

    const isMerge = (status(to)?.exists ?? false) || (renameTargets.get(to) ?? 0) > 1;
    const key = renameKey(from);
    entries.push({
      key,
      kind: "rename",
      name: from,
      count: countOf(from),
      to,
      merge: isMerge,
      mergedCount: projection?.mergedCounts[to],
      ...finish(key, problem),
    });
  }

  for (const name of cs.deletes) {
    let problem: string | null = null;
    const emptied = projection?.emptiedBy[name] ?? 0;
    if (status(name)?.exists === false) problem = `「${name}」已不存在，可能已被外部操作改動`;
    else if (emptied > 0) problem = `有 ${emptied} 張圖片會因此失去最後一個標籤`;
    const key = deleteKey(name);
    entries.push({ key, kind: "delete", name, count: countOf(name), ...finish(key, problem) });
  }

  for (const [name, hidden] of Object.entries(cs.hidden)) {
    let problem: string | null = null;
    if (cs.renames[name] !== undefined) problem = `「${name}」已被排入重新命名，請對新名稱設定顯隱`;
    else if (status(name)?.exists === false) problem = `「${name}」已不存在，可能已被外部操作改動`;
    const key = hiddenKey(name);
    entries.push({ key, kind: "hidden", name, count: countOf(name), hidden, ...finish(key, problem) });
  }

  return entries;
}

/** 切換單一項目的勾選狀態（直接操作外部傳入的集合） */
export function toggleEntry(checkedKeys: Set<string>, key: string): void {
  if (checkedKeys.has(key)) checkedKeys.delete(key);
  else checkedKeys.add(key);
}

/** 全選／全不選目前可送出的項目（直接操作外部傳入的集合） */
export function toggleAllEntries(checkedKeys: Set<string>, entries: ReviewEntry[]): void {
  const eligible = entries.filter((e) => e.problem === null);
  const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
  for (const e of eligible) {
    if (allSelected) checkedKeys.delete(e.key);
    else checkedKeys.add(e.key);
  }
}
