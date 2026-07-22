/**
 * @file review-entry.ts
 * 審查清單一列的投影
 */

import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";

type Drafts = ReturnType<typeof getDraftsContext>;
type Reverts = ReturnType<typeof getRevertMarkContext>;

/** 審查清單上的一列 */
type ReviewEntry = {
  /** 該紀錄的對應檔名 */
  filename: string;
  /** 該紀錄的名稱 */
  name: string;
  /** 對名稱的改動 */
  changeName?: { before: string; after: string };
  /** 對評分的改動 */
  changeRating?: { before: number; after: number };
  /** 對標籤的改動 */
  changeTags?: { toAdd?: string[]; toRemove?: string[]; toDel?: string[] };
  /** 不可提交的原因，或上次提交失敗的原因（null = 無異常） */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
  /** 是否可勾選 */
  checkable: boolean;
};

/** 投影函數的所需參數 */
type BuildParams = { filename: string; drafts: Drafts; reverts: Reverts; checked: boolean; failure?: string };

/**
 * 把一個檔名目前的編輯內容與審查資訊投影成一列審查紀錄
 */
export function buildReviewEntry({ filename, drafts, reverts, checked, failure }: BuildParams): ReviewEntry {
  const snapshot = reverts.draftOf(filename);

  if (snapshot !== undefined) {
    const changeTags = { toDel: snapshot.tags };
    const problem = failure ? `提交失敗：${failure}` : null;

    return { filename, name: snapshot.name, changeTags, problem, checkable: true, checked };
  }

  const draft = drafts.viewOf(filename);
  const name = draft.name.trim();

  const draftProblem = drafts.problemOf(filename);
  const problem = draftProblem ?? (failure ? `提交失敗：${failure}` : null);
  const checkable = problem === null;

  const changeTags = drafts.tagDiffOf(filename);
  const { changeName, changeRating } = drafts.fieldDiffOf(filename);

  return { filename, name, changeName, changeRating, changeTags, problem, checkable, checked: checkable && checked };
}
