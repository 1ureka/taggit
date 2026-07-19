/**
 * @file review-entry.ts
 * 審查清單的資料模型
 */

import type { BoardOperation } from "./board.svelte";
import { isValidTagName } from "./changeset";

/** 審查清單上的一個項目：BoardOperation 疊加審查專屬的旗標 */
export type ReviewEntry = BoardOperation & {
  /** 不可送出的原因，或上次送出失敗的原因 */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
  /** 是否可勾選 */
  checkable: boolean;
};

/** 審查清單上的一個項目的變動種類 */
export type ReviewEntryKind = ReviewEntry["kind"];

/**
 * 由目前畫布的操作投影組審查條目。做客戶端驗證，並與上次送出失敗的原因合併。
 */
export function buildReviewEntries(
  ops: BoardOperation[],
  checked: ReadonlySet<string>,
  failures: Record<string, string>,
): ReviewEntry[] {
  const renamedFromNames = new Set(
    ops.filter((op) => op.kind === "rename" || op.kind === "merge").map((op) => op.name),
  );
  const deletes = new Set(ops.filter((op) => op.kind === "delete").map((op) => op.name));

  return ops.map((op) => {
    let problem: string | null = null;

    if (op.kind === "rename" || op.kind === "merge") {
      if (!isValidTagName(op.to)) problem = "新名稱不合法（1–50 字元、不可含逗號）";
      else if (renamedFromNames.has(op.to)) problem = `目標「${op.to}」本身也被排入重新命名`;
      else if (deletes.has(op.to)) problem = `目標「${op.to}」已被排入刪除`;
    } else if (op.kind === "hidden" || op.kind === "visible") {
      if (renamedFromNames.has(op.name)) problem = `「${op.name}」已被排入重新命名，請對新名稱設定顯隱`;
    }

    const failure = failures[op.name];
    const finalProblem = problem ?? (failure ? `送出失敗：${failure}` : null);
    const checkable = finalProblem === null;

    return { ...op, problem: finalProblem, checkable, checked: checkable && checked.has(op.name) };
  });
}
