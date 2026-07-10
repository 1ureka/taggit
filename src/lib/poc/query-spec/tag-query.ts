/**
 * @file tag-query.ts
 * TagQuery —— 標籤查詢值物件。`scope` 的 present / absent 是正確性關鍵（Q4）：
 *   present（{@link TagQuery.facet}）  → facet：count 在「scope 篩選 + hidden 遮蔽後」計算。
 *   absent （{@link TagQuery.standalone}）→ 獨立列表：count = 原始總使用數，不遮蔽。
 *
 * 用具名建構子讓語意軸成為呼叫端顯式動詞，`scope === undefined` 降為內部細節。
 * 判準是 present vs absent，**不是** empty vs non-empty（空 ImageWhere 仍算 facet）。
 */

import { ImageWhere } from "./image-where.js";
import { TagWhere } from "./tag-where.js";
import { ListOptions } from "./list-options.js";
import type { TagSort } from "./types.js";

export class TagQuery {
  readonly scope?: ImageWhere;
  where: TagWhere;
  list: ListOptions<TagSort>;

  private constructor(scope: ImageWhere | undefined, where: TagWhere, list: ListOptions<TagSort>) {
    this.scope = scope;
    this.where = where;
    this.list = list;
  }

  /** 是否為 faceted 查詢（帶 scope）。 */
  get isFacet(): boolean {
    return this.scope !== undefined;
  }

  private static defaultList(): ListOptions<TagSort> {
    return new ListOptions<TagSort>({ sort: "count", order: "desc" });
  }

  /** facet：以 `scope` 界定的圖片集合計數並套 hidden 遮蔽。 */
  static facet(scope: ImageWhere, where = new TagWhere(), list = TagQuery.defaultList()): TagQuery {
    return new TagQuery(scope, where, list);
  }

  /** 獨立列表：不帶 scope，count = 原始總使用數，不遮蔽。 */
  static standalone(where = new TagWhere(), list = TagQuery.defaultList()): TagQuery {
    return new TagQuery(undefined, where, list);
  }

  /**
   * 從 URL 一律產出 **present**（可能為空的）scope → 凡從 URL 來的側欄一律遮蔽
   * （全新空庫的空 ImageWhere 仍算 facet）。
   */
  static fromSearchParams(params: URLSearchParams): TagQuery {
    return TagQuery.facet(ImageWhere.fromSearchParams(params));
  }
}
