/**
 * @file tag-where.ts
 * TagWhere —— 對標籤本身的述詞（與 scope 的圖片篩選正交）。
 * 主要為未來「標籤為主」頁面預留；先建對稱形狀，述詞機器可延後。
 */

/** {@link TagWhere} 的資料欄位。 */
export type TagWhereFields = {
  name?: string;
  hidden?: boolean;
  universe: "used" | "all";
};

export class TagWhere {
  /** 對標籤名的子字串述詞（中性命名）。 */
  name?: string;
  /** 只列 hidden / 非 hidden；`undefined` = 兩者皆列（與 count 正交）。 */
  hidden?: boolean;
  /** `used`=只列被使用的標籤；`all`=併入僅有 metadata、未使用的標籤（count 0）。 */
  universe: "used" | "all";

  constructor(init: Partial<TagWhereFields> = {}) {
    this.name = init.name;
    this.hidden = init.hidden;
    this.universe = init.universe ?? "used";
  }

  with(patch: Partial<TagWhereFields>): TagWhere {
    return new TagWhere({
      name: "name" in patch ? patch.name : this.name,
      hidden: "hidden" in patch ? patch.hidden : this.hidden,
      universe: patch.universe ?? this.universe,
    });
  }
}
