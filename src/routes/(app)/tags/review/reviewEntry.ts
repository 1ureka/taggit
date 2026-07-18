/**
 * @file reviewEntry.ts
 * 審查清單的資料模型
 */

import type { OneOf } from "$lib/types";
import type { Tag } from "$lib/database";
import { renameKey, deleteKey, hiddenKey, type MergeGroup } from "../logic/changeset";

/** 標籤名稱是否合法 */
export function isValidTagName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 50 && !value.includes(",");
}

type EntryCommon = {
  /** 對應 tags-batch 的操作 key（3 種前綴；與展示用 kind 是兩套獨立系統，見 temp3.md） */
  key: string;
  /** 操作對象名稱 */
  name: string;
  /** 對象的使用數（畫布上的 Tag 快照值） */
  count: number;
  /** 不可送出的原因，或上次送出失敗的原因（null = 可送出） */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
  /** 是否可勾選（無問題且目前沒有正在送出） */
  checkable: boolean;
};

type RenameFamily = EntryCommon & {
  kind: "rename" | "merge";
  /** 目標名稱 */
  to: string;
  /** 合併後目標的預估張數（該合併堆自己查回來的值；只有 merge 才有意義，尚無結果時為 undefined） */
  mergedCount?: number;
};

type DeleteEntry = EntryCommon & { kind: "delete" };

type HiddenFamily = EntryCommon & { kind: "hidden" | "visible" };

/** 審查清單上的一列 */
export type ReviewEntry = OneOf<[RenameFamily, DeleteEntry, HiddenFamily]>;

/** 給 ReviewImpact / ReviewListItem 共用，不用各自手刻一份字面量聯集 */
export type ReviewEntryKind = ReviewEntry["kind"];

/**
 * 由畫布三塊狀態（合併堆、刪除區、顯隱切換區）組審查條目。
 * 只做純本地可判的問題（名稱不合法、rename 目標互相碰撞、目標被排入刪除、
 * hidden 目標同時被排入重新命名）；標籤存在性與刪除清空警告交給送出時的後端把關
 * （not_found 會報錯、last_tag 會擋，兩者都是安全的延後，見 temp3.md）。
 * 上次送出失敗的原因（`failures`）與本地問題合併成同一個 `problem` 欄位；
 * `checkable`／`checked` 一併在這裡折入 `pending`，消費端不用再各自算一次。
 */
export function buildReviewEntries(
  groups: Iterable<MergeGroup>,
  deleteList: Tag[],
  toggleList: Tag[],
  checkedKeys: Set<string>,
  failures: Record<string, string>,
  pending: boolean,
): ReviewEntry[] {
  const groupList = [...groups];
  const deletes = new Set(deleteList.map((t) => t.name));
  const renamedFromNames = new Set(
    groupList.flatMap((g) => g.members.filter((m) => m.name !== g.canonical.trim()).map((m) => m.name)),
  );

  /** 併入上次送出失敗的原因，並依最終問題與 pending 推導可勾選／勾選狀態 */
  const finish = (key: string, problem: string | null) => {
    const failure = failures[key];
    const finalProblem = problem ?? (failure ? `送出失敗：${failure}` : null);
    const checkable = finalProblem === null && !pending;
    return { problem: finalProblem, checkable, checked: checkable && checkedKeys.has(key) };
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

      const key = renameKey(m.name);
      entries.push({
        key,
        kind: isMerge ? "merge" : "rename",
        name: m.name,
        count: m.count,
        to: canonical,
        mergedCount: g.mergeCount ?? undefined,
        ...finish(key, problem),
      });
    }
  }

  for (const t of deleteList) {
    const key = deleteKey(t.name);
    entries.push({ key, kind: "delete", name: t.name, count: t.count, ...finish(key, null) });
  }

  for (const t of toggleList) {
    let problem: string | null = null;
    if (renamedFromNames.has(t.name)) problem = `「${t.name}」已被排入重新命名，請對新名稱設定顯隱`;

    const key = hiddenKey(t.name);
    entries.push({
      key,
      kind: t.meta.hidden ? "visible" : "hidden",
      name: t.name,
      count: t.count,
      ...finish(key, problem),
    });
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
  const eligible = entries.filter((e) => e.checkable);
  const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
  for (const e of eligible) {
    if (allSelected) checkedKeys.delete(e.key);
    else checkedKeys.add(e.key);
  }
}
