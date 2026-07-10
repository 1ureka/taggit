/**
 * @file scope.ts
 * 將 ImageWhere 解析為位元圖 scope 的執行器
 *
 * hidden 語義：設 H = hidden 標籤集合、Q = 查詢的 includedTags，
 * 圖片被遮蔽 ⇔ 存在 h ∈ H 使圖片擁有 h 且 h ∉ Q。
 */

import { BitSet, type Database } from "$lib/poc/database";
import type { ImageWhere } from "$lib/poc/query-spec";
import { isNonEmpty } from "$lib/utils/shared";

/** scope 解析結果：遮蔽前 / 遮蔽後 + 正規化的 includedTags 集合。 */
export interface Scope {
  /** 篩選後、hidden 遮蔽**前**的集合。 */
  preHidden: BitSet;
  /** 篩選後、hidden 遮蔽**後**的可見集合。 */
  visible: BitSet;
  /** 查詢的 includedTags 集合（hidden 遮罩的豁免集）。 */
  included: Set<string>;
}

export class ScopeResolver {
  constructor(private db: Database) {}

  /** 把 ImageWhere 解析成位元圖 scope。 */
  resolve(where: ImageWhere): Scope {
    const included = new Set(where.includedTags);
    const preHidden = this.filterBeforeHidden(where);
    const mask = this.hiddenMask(included);
    const visible = mask ? preHidden.clone().andNotInPlace(mask) : preHidden;
    return { preHidden, visible, included };
  }

  /** 目前被標記為 hidden 的標籤名稱集合。 */
  hiddenNames(): Set<string> {
    const names = new Set<string>();
    for (const [name, meta] of this.db.tagMetaEntries()) {
      if (meta.hidden === true) names.add(name);
    }
    return names;
  }

  /** hidden 遮罩：所有「hidden 且 ∉ exclude」標籤位元圖的聯集；無適用者回 `null`。 */
  hiddenMask(exclude: ReadonlySet<string>): BitSet | null {
    let mask: BitSet | null = null;
    for (const name of this.hiddenNames()) {
      if (exclude.has(name)) continue;
      const bits = this.db.tagBits(name);
      if (!bits) continue;
      if (!mask) mask = new BitSet();
      mask.orInPlace(bits);
    }
    return mask;
  }

  /**
   * 管線第 1–4 步（含 rating 與 search，不含 hidden 遮罩）：
   * live ∩ includes ∖ excludes ∩ rating，再以名稱子字串後置過濾。回傳新配置的位元圖。
   */
  private filterBeforeHidden(where: ImageWhere): BitSet {
    const db = this.db;
    let result = db.liveClone;

    // 1. 包含標籤：AND；任一標籤不存在，交集必為空
    if (isNonEmpty(where.includedTags)) {
      for (const tag of where.includedTags) {
        const bits = db.tagBits(tag);
        if (!bits) return new BitSet();
        result.andInPlace(bits);
      }
    }

    // 2. 排除標籤：ANDNOT；不存在則忽略
    if (isNonEmpty(where.excludedTags)) {
      for (const tag of where.excludedTags) {
        const bits = db.tagBits(tag);
        if (bits) result.andNotInPlace(bits);
      }
    }

    // 3. 評分：與評分區間位元圖的交集
    if (where.rating !== undefined) {
      const [from, to] =
        where.ratingOp === "gte"
          ? [where.rating, 5]
          : where.ratingOp === "lte"
            ? [0, where.rating]
            : [where.rating, where.rating];
      result.andInPlace(db.ratingRange(from, to));
    }

    // 4. 名稱子字串：位元圖無法表達，迭代候選後置過濾並收斂回位元圖
    const search = where.search.trim().toLowerCase();
    if (search) {
      const matched = new BitSet();
      for (const ordinal of result.values()) {
        const id = db.idOf(ordinal);
        if (id === null) continue;
        const rec = db.getImage(id);
        if (rec && rec.name.toLowerCase().includes(search)) matched.set(ordinal);
      }
      result = matched;
    }

    return result;
  }
}
