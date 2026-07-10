/**
 * @file tag-query.ts
 * 標籤查詢值物件
 */

import { TagWhere } from "./tag-where";
import { ListOptions } from "./list-options";
import { TAG_SORTS, type TagSort } from "./types";
import { safeInt, parseEnum } from "./parse";

export class TagQuery {
  where: TagWhere;
  list: ListOptions<TagSort>;

  constructor(where: TagWhere = new TagWhere(), list?: ListOptions<TagSort>) {
    this.where = where;
    this.list = list ?? new ListOptions<TagSort>({ sort: "count", order: "desc" });
  }

  /** 複製當前條件並覆寫部分欄位，回傳一個全新的值物件 (單層覆寫) */
  with(patch: { where?: TagWhere; list?: ListOptions<TagSort> }): TagQuery {
    return new TagQuery(patch.where ?? this.where, patch.list ?? this.list);
  }

  /** 從 URL 查詢參數 (URLSearchParams) 解析並建立完整的查詢值物件 (含篩選、排序與分頁) */
  static fromSearchParams(params: URLSearchParams): TagQuery {
    const list = new ListOptions<TagSort>({
      sort: parseEnum(params.get("sort"), TAG_SORTS) ?? "count",
      order: parseEnum(params.get("order"), ["asc", "desc"]) ?? "desc",
      page: safeInt(params.get("page")),
      limit: safeInt(params.get("limit")),
    });
    return new TagQuery(TagWhere.fromSearchParams(params), list);
  }

  /** 將所有篩選、排序與分頁條件合併轉換為 URL 查詢參數 (自動忽略預設值以精簡網址) */
  toSearchParams(): URLSearchParams {
    const p = this.where.toSearchParams();
    if (this.list.sort !== "count") p.set("sort", this.list.sort);
    if (this.list.order !== "desc") p.set("order", this.list.order);
    if (this.list.page > 1) p.set("page", String(this.list.page));
    if (this.list.limit > 0) p.set("limit", String(this.list.limit));
    return p;
  }
}
