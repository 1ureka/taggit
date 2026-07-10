/**
 * @file image-query.ts
 * ImageQuery —— 圖片查詢值物件：篩選述詞 + 排序分頁。
 * 領域預設（sort=rating / order=desc）於此確立並在 serialize 時省略。
 */

import { ImageWhere } from "./image-where.js";
import { ListOptions } from "./list-options.js";
import { IMAGE_SORTS, type ImageSort } from "./types.js";
import { safeInt, parseEnum } from "./parse.js";

export class ImageQuery {
  where: ImageWhere;
  list: ListOptions<ImageSort>;

  constructor(where: ImageWhere = new ImageWhere(), list?: ListOptions<ImageSort>) {
    this.where = where;
    this.list = list ?? new ListOptions<ImageSort>({ sort: "rating", order: "desc" });
  }

  with(patch: { where?: ImageWhere; list?: ListOptions<ImageSort> }): ImageQuery {
    return new ImageQuery(patch.where ?? this.where, patch.list ?? this.list);
  }

  static fromSearchParams(params: URLSearchParams): ImageQuery {
    const list = new ListOptions<ImageSort>({
      sort: parseEnum(params.get("sort"), IMAGE_SORTS) ?? "rating",
      order: parseEnum(params.get("order"), ["asc", "desc"]) ?? "desc",
      page: safeInt(params.get("page")),
      limit: safeInt(params.get("limit")),
    });
    return new ImageQuery(ImageWhere.fromSearchParams(params), list);
  }

  toSearchParams(): URLSearchParams {
    const p = this.where.toSearchParams();
    if (this.list.sort !== "rating") p.set("sort", this.list.sort);
    if (this.list.order !== "desc") p.set("order", this.list.order);
    if (this.list.page > 1) p.set("page", String(this.list.page));
    if (this.list.limit > 0) p.set("limit", String(this.list.limit));
    return p;
  }
}
