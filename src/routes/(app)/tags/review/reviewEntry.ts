/**
 * @file reviewEntry.ts
 * 審查清單的資料模型：把畫布狀態（合併堆／刪除區／顯隱切換區）與頁面旗標
 * （勾選、上次送出失敗原因）拼成一列列可審查的紀錄，並提供全選/全不選。
 * 合併後張數（mergedCount）直接讀該合併堆自己查回來的 mergeCount，不再有集中式預覽。
 */

import type { Tag } from "$lib/database";
import { renameKey, deleteKey, hiddenKey, type MergeGroup } from "../logic/changeset";

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
  /** 對象的使用數（畫布上的 Tag 快照值） */
  count: number;
  /** rename 目標 */
  to?: string;
  /** rename 是否為合併（該合併堆有多個成員） */
  merge?: boolean;
  /** 合併後目標的預估張數（該合併堆自己查回來的值；尚無結果時為 undefined） */
  mergedCount?: number;
  /** hidden 操作的目標值 */
  hidden?: boolean;
  /** 不可送出的原因，或上次送出失敗的原因（null = 可送出） */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
};

/**
 * 由畫布三塊狀態（合併堆、刪除區、顯隱切換區）組審查條目。
 * 只做純本地可判的問題（名稱不合法、rename 目標互相碰撞、目標被排入刪除、
 * hidden 目標同時被排入重新命名）；標籤存在性與刪除清空警告交給送出時的後端把關
 * （last_tag 會擋、not_found 會報錯，兩者都是安全的延後，見 temp3.md 3.1）。
 * 上次送出失敗的原因（`failures`）與本地問題合併成同一個 `problem` 欄位。
 */
export function buildReviewEntries(
  groups: MergeGroup[],
  deleteList: Tag[],
  toggleList: Tag[],
  checkedKeys: Set<string>,
  failures: Record<string, string>,
): ReviewEntry[] {
  const deletes = new Set(deleteList.map((t) => t.name));
  const renamedFromNames = new Set(
    groups.flatMap((g) => g.members.filter((m) => m.name !== g.canonical.trim()).map((m) => m.name)),
  );

  /** 併入上次送出失敗的原因，並依最終問題推導勾選狀態 */
  const finish = (key: string, problem: string | null) => {
    const failure = failures[key];
    const finalProblem = problem ?? (failure ? `送出失敗：${failure}` : null);
    return { problem: finalProblem, checked: checkedKeys.has(key) && finalProblem === null };
  };

  const entries: ReviewEntry[] = [];

  for (const g of groups) {
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
        kind: "rename",
        name: m.name,
        count: m.count,
        to: canonical,
        merge: isMerge,
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
      kind: "hidden",
      name: t.name,
      count: t.count,
      hidden: !t.meta.hidden,
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
  const eligible = entries.filter((e) => e.problem === null);
  const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
  for (const e of eligible) {
    if (allSelected) checkedKeys.delete(e.key);
    else checkedKeys.add(e.key);
  }
}
