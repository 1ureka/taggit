/**
 * @file changeset.ts
 * /tags 的本地變更集模型：畫布（合併堆／刪除區／顯隱切換區）推導出宣告式變更集。
 * 審查清單的組裝（拼接伺服器預估、頁面旗標）屬於 `../review/reviewEntry.ts`。
 */

import type { Tag } from "$lib/database";

/** 合併堆：members 全部改名為 canonical（canonical 自身除外） */
export type MergeGroup = {
  /** uuid，建立當下由 crypto.randomUUID() 產生 */
  id: string;
  canonical: string;
  members: Tag[];
  /** 合併後的預估張數；null = 尚無結果（含查詢中） */
  mergeCount: number | null;
};

/**
 * 宣告式變更集。同一標籤同時只能有一種操作（畫布的單一位置保證互斥）。
 */
export type TagChangeset = {
  /** 重新命名 from -> to；多個 from 指向同一個 to 即為合併 */
  renames: Record<string, string>;
  /** 待刪除的標籤（會自所有圖片移除） */
  deletes: string[];
  /** 顯隱覆寫 name -> 目標 hidden 值 */
  hidden: Record<string, boolean>;
};

/** 由畫布狀態推導變更集。只在送出當下呼叫一次，不做成常駐 derived（見 temp3.md） */
export function changesetFromBoard(groups: Iterable<MergeGroup>, deleteList: Tag[], toggleList: Tag[]): TagChangeset {
  const cs: TagChangeset = { renames: {}, deletes: [], hidden: {} };
  for (const g of groups) {
    const canonical = g.canonical.trim();
    for (const m of g.members) if (m.name !== canonical) cs.renames[m.name] = canonical;
  }
  cs.deletes = deleteList.map((t) => t.name);
  for (const t of toggleList) cs.hidden[t.name] = !t.meta.hidden;
  return cs;
}

// ─── 操作 key（審查清單的勾選 / 失敗對映用識別碼，與 tags-batch 的回應 key 對齊）───
// api.ts（送出 payload 篩選）與 review/reviewEntry.ts（審查條目組裝）共用同一套 key。

export const renameKey = (from: string) => `rename:${from}`;
export const deleteKey = (name: string) => `delete:${name}`;
export const hiddenKey = (name: string) => `hidden:${name}`;
