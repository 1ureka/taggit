/**
 * @file changeset.ts
 * 標籤變更集的套用前預覽執行器
 */

import { BitSet, type Database } from "$lib/database";
import type { Changeset, ChangesetPreview } from "$lib/query-spec";

export class ChangesetEngine {
  constructor(private db: Database) {}

  /** 查詢變更集的套用預覽。 */
  preview(c: Changeset): ChangesetPreview {
    return {
      tags: this.statuses(c),
      mergedCounts: this.mergedCounts(c),
      ...this.emptied(c),
    };
  }

  /** 查詢變更集提及的每個標籤名的現況 */
  private statuses(c: Changeset): ChangesetPreview["tags"] {
    const db = this.db;
    const metaNames = new Set(db.tagMetaEntries().map(([name]) => name));

    const referenced = new Set<string>([
      ...c.deletes,
      ...c.renames.flatMap((r) => [r.from, r.to]),
      ...c.hidden.map((h) => h.name),
    ]);

    const tags: ChangesetPreview["tags"] = {};
    for (const name of referenced) {
      tags[name] = {
        exists: db.tagCount(name) > 0 || metaNames.has(name),
        count: db.tagCount(name),
        hidden: db.getTagMeta(name).hidden,
      };
    }

    return tags;
  }

  /** 查詢每個重命名目標最終預計的使用量 */
  private mergedCounts(c: Changeset): Record<string, number> {
    const sourcesByTarget = new Map<string, string[]>();
    for (const { from, to } of c.renames) {
      const sources = sourcesByTarget.get(to) ?? [];
      sources.push(from);
      sourcesByTarget.set(to, sources);
    }

    const mergedCounts: Record<string, number> = {};
    for (const [to, froms] of sourcesByTarget) {
      let acc: BitSet | null = null;
      for (const name of [to, ...froms]) {
        const bits = this.db.tagBits(name);
        if (!bits) continue;
        acc = acc ? acc.orInPlace(bits) : bits.clone();
      }
      mergedCounts[to] = acc?.size() ?? 0;
    }

    return mergedCounts;
  }

  /** 查詢是否會使圖片失去所有標籤 */
  private emptied(c: Changeset): Pick<ChangesetPreview, "emptiedBy" | "emptiedTotal"> {
    const emptiedBy: Record<string, number> = {};
    for (const name of c.deletes) emptiedBy[name] = 0;
    let emptiedTotal = 0;

    const deleteSet = new Set(c.deletes);
    if (deleteSet.size > 0) {
      for (const [, rec] of this.db.imageEntries()) {
        if (rec.tags.length === 0) continue;
        if (!rec.tags.every((t) => deleteSet.has(t))) continue;
        emptiedTotal++;
        for (const t of new Set(rec.tags)) emptiedBy[t] = (emptiedBy[t] ?? 0) + 1;
      }
    }

    return { emptiedBy, emptiedTotal };
  }
}
