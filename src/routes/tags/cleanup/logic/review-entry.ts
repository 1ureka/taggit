/**
 * @file review-entry.ts
 * 審查清單的資料模型，由排程操作疊加審查專屬的旗標
 */

import type { CleanupOperation } from "./schedule.svelte";

/** 審查清單上的一個項目：CleanupOperation 疊加審查專屬的旗標 */
export type ReviewEntry = CleanupOperation & {
  /** 不可送出的原因，或上次送出失敗的原因 */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
  /** 是否可勾選 */
  checkable: boolean;
};

/**
 * 由目前排程的操作投影出審查條目。做客戶端驗證（合併目標衝突），並與上次送出失敗的原因合併。
 */
export function buildReviewEntries(
  ops: CleanupOperation[],
  checked: ReadonlySet<string>,
  failures: Record<string, string>,
): ReviewEntry[] {
  const mergedFromNames = new Set(ops.filter((op) => op.kind === "merge").map((op) => op.name));
  const deletes = new Set(ops.filter((op) => op.kind === "delete").map((op) => op.name));

  return ops.map((op) => {
    let problem: string | null = null;

    if (op.kind === "merge") {
      if (mergedFromNames.has(op.to)) problem = `目標「${op.to}」本身也被排入合併`;
      else if (deletes.has(op.to)) problem = `目標「${op.to}」已被排入刪除`;
    }

    const failure = failures[op.name];
    const finalProblem = problem ?? (failure ? `送出失敗：${failure}` : null);
    const checkable = finalProblem === null;

    return { ...op, problem: finalProblem, checkable, checked: checkable && checked.has(op.name) };
  });
}
