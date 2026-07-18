/**
 * @file reviewEntry.ts
 * 審查清單的資料模型
 */

import type { OneOf } from "$lib/types";
import type { Tag } from "$lib/database";
import type { MergeGroup } from "../logic/changeset";

type EntryCommon = {
  /** 標籤名稱 */
  name: string;
  /** 標籤的使用數 */
  count: number;
  /** 不可送出的原因，或上次送出失敗的原因 */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
  /** 是否可勾選 */
  checkable: boolean;
};

type RenameFamily = EntryCommon & {
  /** 該項目的變動種類  */
  kind: "rename" | "merge";
  /** 目標名稱 */
  to: string;
  /** 合併或重命名後目標的預估張數 */
  mergedCount?: number;
};

type DeleteEntry = EntryCommon & {
  /** 該項目的變動種類  */
  kind: "delete";
};

type HiddenFamily = EntryCommon & {
  /** 該項目的變動種類  */
  kind: "hidden" | "visible";
};

/** 審查清單上的一個項目 */
export type ReviewEntry = OneOf<[RenameFamily, DeleteEntry, HiddenFamily]>;

/** 審查清單上的一個項目的變動種類 */
export type ReviewEntryKind = ReviewEntry["kind"];

// ---

/** 標籤名稱是否合法 */
function isValidTagName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 50 && !value.includes(",");
}

/** 切換單一項目的勾選狀態（直接操作外部傳入的集合） */
export function toggleEntry(checkedTags: Set<string>, name: string): void {
  if (checkedTags.has(name)) checkedTags.delete(name);
  else checkedTags.add(name);
}

/** 全選／全不選目前可送出的項目（直接操作外部傳入的集合） */
export function toggleAllEntries(checkedTags: Set<string>, entries: ReviewEntry[]): void {
  const eligible = entries.filter((e) => e.checkable);
  const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
  for (const e of eligible) {
    if (allSelected) checkedTags.delete(e.name);
    else checkedTags.add(e.name);
  }
}

// ---

/**
 * 由當前草稿組審查條目。做客戶端驗證，若有後端驗證結果，將其與本地問題合併
 * TODO: 整理該函數
 */
export function buildReviewEntries(
  groups: Iterable<MergeGroup>,
  deleteList: Tag[],
  hiddenList: Tag[],
  checkedTags: Set<string>,
  failures: Record<string, string>,
  pending: boolean,
): ReviewEntry[] {
  const groupList = [...groups];
  const deletes = new Set(deleteList.map((t) => t.name));
  const renamedFromNames = new Set(
    groupList.flatMap((g) => g.members.filter((m) => m.name !== g.canonical.trim()).map((m) => m.name)),
  );

  /** 併入上次送出失敗的原因，並依最終問題與 pending 推導可勾選／勾選狀態 */
  const finish = (name: string, problem: string | null) => {
    const failure = failures[name];
    const finalProblem = problem ?? (failure ? `送出失敗：${failure}` : null);
    const checkable = finalProblem === null && !pending;
    return { problem: finalProblem, checkable, checked: checkable && checkedTags.has(name) };
  };

  const entries: ReviewEntry[] = [];

  for (const g of groupList) {
    const canonical = g.canonical.trim();
    const isMerge = g.members.length > 1;

    for (const m of g.members) {
      if (m.name === canonical) continue;

      let problem: string | null = null;
      if (!isValidTagName(canonical)) problem = "新名稱不合法（1–50 字元、不可含逗號）";
      else if (renamedFromNames.has(canonical)) problem = `目標「${canonical}」本身也被排入重新命名`;
      else if (deletes.has(canonical)) problem = `目標「${canonical}」已被排入刪除`;

      entries.push({
        kind: isMerge ? "merge" : "rename",
        name: m.name,
        count: m.count,
        to: canonical,
        mergedCount: g.mergeCount ?? undefined,
        ...finish(m.name, problem),
      });
    }
  }

  for (const t of deleteList) {
    entries.push({ kind: "delete", name: t.name, count: t.count, ...finish(t.name, null) });
  }

  for (const t of hiddenList) {
    let problem: string | null = null;
    if (renamedFromNames.has(t.name)) problem = `「${t.name}」已被排入重新命名，請對新名稱設定顯隱`;

    entries.push({
      kind: t.meta.hidden ? "visible" : "hidden",
      name: t.name,
      count: t.count,
      ...finish(t.name, problem),
    });
  }

  return entries;
}
