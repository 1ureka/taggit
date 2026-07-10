/**
 * @file tag-query.ts
 * 標籤查詢值物件
 */

import { TagWhere } from "./tag-where";
import { ListOptions } from "./list-options";
import type { TagSort } from "./types";

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

  /** 將所有篩選、排序與分頁條件合併轉換為 URL 查詢參數 (自動忽略預設值以精簡網址) */
}
