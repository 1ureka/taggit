/**
 * @file image-query.ts
 * 圖片查詢值物件 (篩選 + 排序&分頁)
 */

import { ImageWhere } from "./image-where";
import { ListOptions } from "./list-options";
import { IMAGE_SORTS, type ImageSort } from "./types";
import { safeInt, parseEnum } from "./parse";

export class ImageQuery {
  where: ImageWhere;
  list: ListOptions<ImageSort>;

  constructor(where: ImageWhere = new ImageWhere(), list?: ListOptions<ImageSort>) {
    this.where = where;
    this.list = list ?? new ListOptions<ImageSort>({ sort: "rating", order: "desc" });
  }

  /** 複製當前條件並覆寫部分欄位，回傳一個全新的值物件 (單層覆寫) */
  with(patch: { where?: ImageWhere; list?: ListOptions<ImageSort> }): ImageQuery {
    return new ImageQuery(patch.where ?? this.where, patch.list ?? this.list);
  }

  /** 從 URL 查詢參數 (URLSearchParams) 解析並建立完整的圖片查詢值物件 (含篩選、排序與分頁) */
  static fromSearchParams(params: URLSearchParams): ImageQuery {
    const list = new ListOptions<ImageSort>({
      sort: parseEnum(params.get("sort"), IMAGE_SORTS) ?? "rating",
      order: parseEnum(params.get("order"), ["asc", "desc"]) ?? "desc",
      page: safeInt(params.get("page")),
      limit: safeInt(params.get("limit")),
    });
    return new ImageQuery(ImageWhere.fromSearchParams(params), list);
  }

  /** 將所有篩選、排序與分頁條件合併轉換為 URL 查詢參數 (自動忽略預設值以精簡網址) */
  toSearchParams(): URLSearchParams {
    const p = this.where.toSearchParams();
    if (this.list.sort !== "rating") p.set("sort", this.list.sort);
    if (this.list.order !== "desc") p.set("order", this.list.order);
    if (this.list.page > 1) p.set("page", String(this.list.page));
    if (this.list.limit > 0) p.set("limit", String(this.list.limit));
    return p;
  }
}
