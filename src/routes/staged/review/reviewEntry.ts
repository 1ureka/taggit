import { imgSrc } from "$lib/image/client";
import { problemOf, stripExt, type Draft } from "../inspector/draft";

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
  /** 是否不可勾選 */
  disabled: boolean;
};

/** 把一張暫存圖片的 draft 與外部旗標（勾選、上次失敗原因、是否處理中）拼成一列審查紀錄 */
export function buildReviewEntry(
  filename: string,
  draft: Draft,
  checked: boolean,
  pending: boolean,
  failure?: string,
): ReviewEntry {
  const problem = problemOf(draft);

  return {
    filename,
    imgSrc: imgSrc(filename, "sm"),
    name: draft.name.trim() || stripExt(filename),
    rating: draft.rating,
    tags: draft.tags,
    problem: problem ?? (failure ? `提交失敗：${failure}` : null),
    checked: problem === null && checked,
    disabled: problem !== null || pending,
  };
}

/** 目前已勾選的項目提交後會新建立的標籤（不存在於既有標籤中） */
export function computeNewTags(entries: ReviewEntry[], existingTagNames: string[]): string[] {
  const existing = new Set(existingTagNames);
  const result = new Set<string>();

  for (const e of entries) {
    if (!e.checked) continue;
    for (const t of e.tags) {
      const trimmed = t.trim();
      if (trimmed && !existing.has(trimmed)) result.add(trimmed);
    }
  }

  return [...result];
}

/** 切換單一項目的勾選狀態（直接操作外部傳入的集合） */
export function toggleEntry(checkedFiles: Set<string>, filename: string): void {
  if (checkedFiles.has(filename)) checkedFiles.delete(filename);
  else checkedFiles.add(filename);
}

/** 全選／全不選目前可勾選的項目（直接操作外部傳入的集合） */
export function toggleAllEntries(checkedFiles: Set<string>, entries: ReviewEntry[]): void {
  const eligible = entries.filter((e) => !e.disabled);
  const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
  for (const e of eligible) {
    if (allSelected) checkedFiles.delete(e.filename);
    else checkedFiles.add(e.filename);
  }
}
