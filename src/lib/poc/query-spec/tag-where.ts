/**
 * @file tag-where.ts
 * 標籤篩選值物件
 */

import { parseBool, parseEnum } from "./parse";

/** {@link TagWhere} 的資料欄位 (去掉方法) */
export type TagWhereFields = {
  name?: string;
  hidden?: boolean;
  universe: "used" | "all";
};

export class TagWhere {
  /** 標籤名稱子字串搜尋。 */
  name?: string;
  /** 只列 hidden / 非 hidden；`undefined` = 兩者皆列。 */
  hidden?: boolean;
  /** `used`=只列被使用的標籤；`all`=併入僅有 metadata、未使用的標籤（count 0）。 */
  universe: "used" | "all";

  constructor(init: Partial<TagWhereFields> = {}) {
    this.name = init.name;
    this.hidden = init.hidden;
    this.universe = init.universe ?? "used";
  }

  /** 複製當前條件並覆寫部分欄位，回傳一個全新的值物件 */
  with(patch: Partial<TagWhereFields>): TagWhere {
    return new TagWhere({
      name: "name" in patch ? patch.name : this.name,
      hidden: "hidden" in patch ? patch.hidden : this.hidden,
      universe: patch.universe ?? this.universe,
    });
  }

  /** 從 URL 查詢參數（URLSearchParams）解析並建立值物件 */
  static fromSearchParams(params: URLSearchParams): TagWhere {
    return new TagWhere({
      name: params.get("name") ?? undefined,
      hidden: parseBool(params.get("hidden")),
      universe: parseEnum(params.get("universe"), ["used", "all"]),
    });
  }

  /** 將當前篩選條件轉換為 URL 查詢參數 (自動忽略預設值以精簡網址) */
  toSearchParams(): URLSearchParams {
    const p = new URLSearchParams();
    if (this.name?.trim()) p.set("name", this.name.trim());
    if (this.hidden !== undefined) p.set("hidden", String(this.hidden));
    if (this.universe !== "used") p.set("universe", this.universe);
    return p;
  }
}
