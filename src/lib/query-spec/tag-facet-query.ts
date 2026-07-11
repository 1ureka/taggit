/**
 * @file tag-facet-query.ts
 * 分面標籤查詢值物件
 */

import { ImageWhere } from "./image-where";
import { TagQuery } from "./tag-query";
import type { TagWhere } from "./tag-where";
import type { ListOptions } from "./list-options";
import type { TagSort } from "./types";

export class TagFacetQuery {
  readonly scope: ImageWhere;
  readonly tags: TagQuery;

  constructor(scope: ImageWhere, tags: TagQuery = new TagQuery()) {
    this.scope = scope;
    this.tags = tags;
  }

  get where(): TagWhere {
    return this.tags.where;
  }
  get list(): ListOptions<TagSort> {
    return this.tags.list;
  }

  /** 複製當前條件並覆寫部分欄位，回傳一個全新的值物件 (單層覆寫) */
  with(patch: { scope?: ImageWhere; tags?: TagQuery }): TagFacetQuery {
    return new TagFacetQuery(patch.scope ?? this.scope, patch.tags ?? this.tags);
  }

  /** 將分面篩選條件合併轉換為 URL 查詢參數，注意不包括標籤本身的篩選、分頁等條件 */
  static fromSearchParams(params: URLSearchParams): TagFacetQuery {
    return new TagFacetQuery(ImageWhere.fromSearchParams(params));
  }
}
