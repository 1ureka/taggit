/**
 * @file tags.ts
 * 標籤查詢器
 */

import { sortCollator } from "$lib/utils/shared";
import type { Database, Tag } from "$lib/database";
import type { ImageWhere, ListOptions, TagFacetQuery, TagQuery, TagSort, TagWhere } from "$lib/query-spec";

import type { ScopeResolver } from "./scope";
import type { QueryResult } from "./result";
import { paginate } from "./pagination";

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
    const hiddenSet = this.scope.hiddenNames();
    const tags: Tag[] = [];

    for (const name of this.db.sortedTags()) {
      const bits = this.db.tagBits(name);
      if (!bits) continue;
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
    const hiddenSet = this.scope.hiddenNames();
    const tags: Tag[] = [];

    for (const name of this.db.sortedTags()) {
      if (!this.passesWhere(name, hiddenSet.has(name), where)) continue;
      tags.push({ name, count: this.db.tagCount(name), meta: this.db.getTagMeta(name) });
    }

    this.appendUnused(where, tags);
    return tags;
  }

  /** `universe="all"` 併入僅有元資料、未被使用的標籤，不在 `sortedTags` 內，依名稱二分插入既有的名稱序 */
  private appendUnused(where: TagWhere, tags: Tag[]): void {
    if (where.universe !== "all") return;
    const hiddenSet = this.scope.hiddenNames();
    for (const [name] of this.db.tagMetaEntries()) {
      if (this.db.tagBits(name)) continue;
      if (!this.passesWhere(name, hiddenSet.has(name), where)) continue;
      this.insertByName(tags, { name, count: 0, meta: this.db.getTagMeta(name) });
    }
  }

  /** 依名稱升冪二分插入 tag，維持 list 的名稱序。 */
  private insertByName(list: Tag[], tag: Tag): void {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sortCollator.compare(list[mid].name, tag.name) < 0) lo = mid + 1;
      else hi = mid;
    }
    list.splice(lo, 0, tag);
  }

  /** 套用 TagWhere 的標籤名 / hidden 述詞（universe 於各分支另處理）。 */
  private passesWhere(name: string, isHidden: boolean, where: TagWhere): boolean {
    if (where.hidden !== undefined && where.hidden !== isHidden) return false;
    if (where.name && !name.toLowerCase().includes(where.name.toLowerCase())) return false;
    return true;
  }

  /**
   * items 已依名稱升冪 (透過 `db.sortedTags()`, `appendUnused`)
   * 故排序只需 count 靠穩定排序保留名稱序 tiebreak
   */
  private sort(items: Tag[], sort: TagSort, order: "asc" | "desc"): Tag[] {
    if (sort === "count") {
      const dir = order === "asc" ? 1 : -1;
      // 穩定排序：count 並列者保留既有名稱升冪（等同原本的 name 一律升冪 tiebreak）
      items.sort((a, b) => dir * (a.count - b.count));
      return items;
    }
    // sort === "name"：已是升冪，降冪則反轉
    if (order === "desc") items.reverse();
    return items;
  }
}
