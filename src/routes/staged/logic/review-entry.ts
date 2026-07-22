/**
 * @file review-entry.ts
 * 審查清單一列的投影型別與組裝
 */

import { imgSrc } from "$lib/image/client";
import { problemOf, stripExt, type Draft } from "./draft";

/** 審查清單上的一列。 */
export type ReviewEntry = {
  /** 該紀錄的對應檔名 */
  filename: string;
  /** 該紀錄的縮圖 src */
  imgSrc: string;
  /** 生效的名稱（暫存名稱或去副檔名的檔名） */
  name: string;
  /** 該紀錄的評分 */
  rating: number;
  /** 該紀錄的標籤 */
  tags: string[];
  /** 不可提交的原因，或上次提交失敗的原因（null = 無異常） */
  problem: string | null;
  /** 是否已被勾選 */
  checked: boolean;
  /** 是否可勾選 */
  checkable: boolean;
};

/** 把一張暫存圖片的 draft 與外部旗標（勾選、上次失敗原因）拼成一列審查紀錄 */
export function buildReviewEntry(filename: string, draft: Draft, checked: boolean, failure?: string): ReviewEntry {
  const problem = problemOf(draft);

  return {
    filename,
    imgSrc: imgSrc(filename, "sm"),
    name: draft.name.trim() || stripExt(filename),
    rating: draft.rating,
    tags: draft.tags,
    problem: problem ?? (failure ? `提交失敗：${failure}` : null),
    checked: problem === null && checked,
    checkable: problem === null,
  };
}
