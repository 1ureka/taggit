/**
 * @file projection.ts
 * 標籤變更集的套用前預覽：合併後張數（位圖聯集）、刪除造成的
 * 「失去最後一個標籤」統計、逐標籤現況。/tags 的畫布預估與審查 modal 共用。
 */

import { BitSet, type Database } from "$lib/database";

/** 變更集規格（與 `api/proto/tags-batch` 的 body 同構） */
export type TagChangesetSpec = {
  /** 待刪除的標籤（以現存名稱為準，會自所有圖片移除） */
  deletes: string[];
  /** 重新命名 from -> to；多個 from 指向同一個 to 即為合併 */
  renames: { from: string; to: string }[];
  /** 顯隱覆寫 */
  hidden: { name: string; hidden: boolean }[];
};

/** 變更集提及的單一標籤現況 */
export type TagStatus = {
  /** 使用中（count > 0）或存在持久化 meta */
  exists: boolean;
  /** 目前的使用數 */
  count: number;
  /** 目前的顯隱狀態 */
  hidden: boolean;
};

/** 變更集套用前預覽 */
export type TagProjection = {
  /** 變更集提及的每個標籤名（deletes、renames 兩端、hidden）的現況 */
  tags: Record<string, TagStatus>;
  /** 每個 rename 目標套用變更集後的預估張數（目標 ∪ 各來源的位圖聯集大小） */
  mergedCounts: Record<string, number>;
  /** 每個排程刪除的標籤會使多少張圖片失去最後一個標籤 */
  emptiedBy: Record<string, number>;
  /** 會失去所有標籤的圖片總數（只有刪除會造成清空） */
  emptiedTotal: number;
};

/** 計算變更集的套用前預覽。純讀取，不改動 db。 */
export function projectChangeset(db: Database, spec: TagChangesetSpec): TagProjection {
  const metaNames = new Set(db.tagMetaEntries().map(([name]) => name));

  const statusOf = (name: string): TagStatus => ({
    exists: db.tagCount(name) > 0 || metaNames.has(name),
    count: db.tagCount(name),
    hidden: db.getTagMeta(name).hidden,
  });

  const referenced = new Set<string>([
    ...spec.deletes,
    ...spec.renames.flatMap((r) => [r.from, r.to]),
    ...spec.hidden.map((h) => h.name),
  ]);

  const tags: Record<string, TagStatus> = {};
  for (const name of referenced) tags[name] = statusOf(name);

  // ── 合併預估：每個 rename 目標 = 目標自身 ∪ 全部改名到它的來源 ──

  const sourcesByTarget = new Map<string, string[]>();
  for (const { from, to } of spec.renames) {
    const sources = sourcesByTarget.get(to) ?? [];
    sources.push(from);
    sourcesByTarget.set(to, sources);
  }

  const mergedCounts: Record<string, number> = {};
  for (const [to, froms] of sourcesByTarget) {
    let acc: BitSet | null = null;
    for (const name of [to, ...froms]) {
      const bits = db.tagBits(name);
      if (!bits) continue;
      acc = acc ? acc.orInPlace(bits) : bits.clone();
    }
    mergedCounts[to] = acc?.size() ?? 0;
  }

  // ── 清空警告：只有刪除會使圖片失去標籤，掃一次全部圖片 ──

  const emptiedBy: Record<string, number> = {};
  for (const name of spec.deletes) emptiedBy[name] = 0;
  let emptiedTotal = 0;

  const deleteSet = new Set(spec.deletes);
  if (deleteSet.size > 0) {
    for (const [, rec] of db.imageEntries()) {
      if (rec.tags.length === 0) continue;
      if (!rec.tags.every((t) => deleteSet.has(t))) continue;
      emptiedTotal++;
      for (const t of new Set(rec.tags)) emptiedBy[t] = (emptiedBy[t] ?? 0) + 1;
    }
  }

  return { tags, mergedCounts, emptiedBy, emptiedTotal };
}
