/**
 * @file draft.ts
 * 暫存草稿的型別、驗證與批次提交
 */

import { api } from "$lib/utils/request";

/** 每張暫存圖片的本地暫存（未送出的修改） */
export type Draft = {
  /** 圖片名稱，留空代表沿用檔名 */
  name: string;
  /** 評等 0–5 */
  rating: number;
  /** 標籤列表 */
  tags: string[];
};

/** 建立空白暫存 */
export function emptyDraft(): Draft {
  return { name: "", rating: 0, tags: [] };
}

/** 這份暫存還不能提交的原因，可提交時回傳 null */
export function problemOf(d: Draft): string | null {
  if (d.name.length > 200) return "名稱不可超過 200 字元";
  if (d.tags.length === 0) return "至少需要一個標籤";

  for (const t of d.tags) {
    if (t.trim().length === 0) return `標籤不可為空`;
    if (t.trim().length > 50) return `標籤「${t}」不可超過 50 字元`;
    if (t.includes(",")) return `標籤「${t}」不可包含逗號`;
  }

  return null;
}

/** 暫存是否被動過（有任何內容） */
export function isTouched(d: Draft): boolean {
  return d.name.trim() !== "" || d.rating > 0 || d.tags.length > 0;
}

/** 去掉副檔名的檔名（未命名時的生效名稱） */
export function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

/** 批次提交端點的回傳結果 */
type BatchItemResult = { filename: string; ok: boolean; error?: string };

/**
 * 批次提交暫存圖片。
 * 回傳失敗項目的 `filename -> 錯誤訊息` 對映（全部成功時為空）。
 * 傳輸層錯誤直接 throw。
 */
export async function commitDrafts(entries: { filename: string; draft: Draft }[]): Promise<Map<string, string>> {
  const items = entries.map(({ filename, draft }) => ({
    filename,
    tags: draft.tags,
    rating: draft.rating,
    ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
  }));

  const res = await api.post<{ results: BatchItemResult[] }>("/api/proto/staged-batch", { items });
  if (!res.ok || !res.data) throw new Error(res.error || "提交失敗");

  const failures = new Map<string, string>();
  for (const r of res.data.results) {
    if (!r.ok) failures.set(r.filename, r.error ?? "未知錯誤");
  }
  return failures;
}
