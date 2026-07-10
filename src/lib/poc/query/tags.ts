/**
 * @file tags.ts
 * TagEngine —— 專心做標籤查詢。兩種 count 與遮蔽語義由**兩個型別**在型別層分派，無 runtime 分支：
 *   {@link TagFacetQuery}（runFacet）→ scope 篩選 + hidden 遮蔽後計數；hidden 非 included 標籤取「解鎖 N 張」。
 *   {@link TagQuery}（runStandalone）→ count = 原始總使用數，不遮蔽。
 * 兩者皆共用 finish：排序 → 分頁。附 meta 用 db.getTagMeta（讀取原語在 database，Q5）。
 */

import type { Database } from "../database/index.js";
import type { ImageWhere, ListOptions, TagFacetQuery, TagQuery, TagSort, TagWhere } from "../query-spec/index.js";
import type { ScopeResolver } from "./scope.js";
import type { QueryResult, Tag } from "./types.js";
import { paginate } from "./pagination.js";
import { sortCollator } from "$lib/utils/shared.js";

export class TagEngine {
  constructor(
    private db: Database,
    private scope: ScopeResolver,
  ) {}

  /** 獨立列表：count = 原始總使用數，不遮蔽。 */
  runStandalone(q: TagQuery): QueryResult<Tag> {
    return this.finish(this.standalone(q.where), q.list);
  }

  /** facet：scope 篩選 + hidden 遮蔽後計數。 */
  runFacet(q: TagFacetQuery): QueryResult<Tag> {
    return this.finish(this.facet(q.scope, q.where), q.list);
  }

  /** 兩分支共用的收尾：排序 → 分頁。 */
  private finish(collected: Tag[], list: ListOptions<TagSort>): QueryResult<Tag> {
    const sorted = this.sort(collected, list.sort, list.order);
    return paginate(sorted, list.page, list.limit);
  }

  /** facet（present scope）：scope 篩選 + hidden 遮蔽後計數。 */
  private facet(scope: ImageWhere, where: TagWhere): Tag[] {
    const { preHidden, visible, included } = this.scope.resolve(scope);
    const hiddenSet = new Set(this.db.hiddenTagNames());
    const tags: Tag[] = [];

    for (const [name, bits] of this.db.tagBitsEntries()) {
      const isHidden = hiddenSet.has(name);
      if (!this.passesWhere(name, isHidden, where)) continue;

      let count: number;
      if (isHidden && !included.has(name)) {
        // 該 hidden 標籤加入篩選後的可見數（篩選 UI 點擊後的預期結果數）
        const excludeSelf = new Set(included);
        excludeSelf.add(name);
        const mask = this.scope.hiddenMask(excludeSelf);
        const base = mask ? preHidden.clone().andNotInPlace(mask) : preHidden;
        count = base.andSize(bits);
      } else {
        count = visible.andSize(bits);
      }

      if (count > 0) tags.push({ name, count, meta: this.db.getTagMeta(name) });
    }

    this.appendUnused(where, tags);
    return tags;
  }

  /** 獨立列表（absent scope）：count = 原始總使用數，不遮蔽。 */
  private standalone(where: TagWhere): Tag[] {
    const hiddenSet = new Set(this.db.hiddenTagNames());
    const tags: Tag[] = [];

    for (const [name, bits] of this.db.tagBitsEntries()) {
      if (!this.passesWhere(name, hiddenSet.has(name), where)) continue;
      tags.push({ name, count: bits.size(), meta: this.db.getTagMeta(name) });
    }

    this.appendUnused(where, tags);
    return tags;
  }

  /** universe="all"：併入僅有元資料、未被任何圖片使用的標籤（count 0）。 */
  private appendUnused(where: TagWhere, tags: Tag[]): void {
    if (where.universe !== "all") return;
    const hiddenSet = new Set(this.db.hiddenTagNames());
    for (const name of this.db.tagMetaNames()) {
      if (this.db.tagBits(name)) continue;
      if (!this.passesWhere(name, hiddenSet.has(name), where)) continue;
      tags.push({ name, count: 0, meta: this.db.getTagMeta(name) });
    }
  }

  /** 套用 TagWhere 的標籤名 / hidden 述詞（universe 於各分支另處理）。 */
  private passesWhere(name: string, isHidden: boolean, where: TagWhere): boolean {
    if (where.hidden !== undefined && where.hidden !== isHidden) return false;
    if (where.name && !name.toLowerCase().includes(where.name.toLowerCase())) return false;
    return true;
  }

  private sort(items: Tag[], sort: TagSort, order: "asc" | "desc"): Tag[] {
    const dir = order === "asc" ? 1 : -1;
    items.sort((a, b) => {
      if (sort === "count") {
        const primary = dir * (a.count - b.count);
        if (primary !== 0) return primary;
        return sortCollator.compare(a.name, b.name); // count 相同時 name 一律升冪
      }
      return dir * sortCollator.compare(a.name, b.name);
    });
    return items;
  }
}
