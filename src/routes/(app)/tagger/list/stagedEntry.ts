import { imgSrc } from "$lib/image/client";
import { isTouched, problemOf, stripExt, type Draft } from "../inspector/draft";

/** 暫存清單上的一列。 */
export type StagedEntry = {
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
  /** 不可提交的原因，只有 touched 時才有意義（null = 可提交） */
  problem: string | null;
  /** 是否已被使用者編輯過（有任何內容） */
  touched: boolean;
  /** 是否為目前檢視中的檔案 */
  current: boolean;
};

/** 把一張暫存圖片的 draft 拼成一列清單紀錄 */
export function buildStagedEntry(filename: string, draft: Draft, current: boolean): StagedEntry {
  return {
    filename,
    imgSrc: imgSrc(filename, "sm"),
    name: draft.name.trim() || stripExt(filename),
    rating: draft.rating,
    tags: draft.tags,
    problem: problemOf(draft),
    touched: isTouched(draft),
    current,
  };
}
