/**
 * @file images.ts
 * ImageEngine —— 專心做圖片查詢：scope → materialize → sort → paginate。
 * 持有 db + 共用 ScopeResolver。image 側一律遮蔽（用 scope.visible）。
 */

import { BitSet, type Database, type ImageWithId } from "../database/index.js";
import type { ImageQuery, ImageSort } from "../query-spec/index.js";
import type { ScopeResolver } from "./scope.js";
import type { QueryResult } from "./types.js";
import { paginate } from "./pagination.js";
import { sortCollator } from "$lib/utils/shared.js";

export class ImageEngine {
  constructor(
    private db: Database,
    private scope: ScopeResolver,
  ) {}

  /** 篩選 + hidden 遮蔽 + 排序 + 分頁。 */
  run(q: ImageQuery): QueryResult<ImageWithId> {
    const { visible } = this.scope.resolve(q.where);
    const sorted = this.sort(this.materialize(visible), q.list.sort, q.list.order);
    return paginate(sorted, q.list.page, q.list.limit);
  }

  /** 將位元圖物化為帶 id 的圖片紀錄（投影答「哪些」、真相答「什麼」）。 */
  private materialize(bits: BitSet): ImageWithId[] {
    const items: ImageWithId[] = [];
    for (const ordinal of bits.values()) {
      const id = this.db.idOf(ordinal);
      if (id === null) continue;
      const rec = this.db.getImage(id);
      if (rec) items.push({ id, ...rec });
    }
    return items;
  }

  private sort(items: ImageWithId[], sort: ImageSort, order: "asc" | "desc"): ImageWithId[] {
    if (sort === "random") {
      shuffle(items);
      return items;
    }

    const dir = order === "asc" ? 1 : -1;
    items.sort((a, b) => {
      if (sort !== "name") {
        const primary = dir * sortCollator.compare(sortKey(a, sort), sortKey(b, sort));
        if (primary !== 0) return primary;
      }
      return dir * sortCollator.compare(a.name.toLowerCase(), b.name.toLowerCase());
    });
    return items;
  }
}

/** 非 name / random 排序軸的鍵。 */
function sortKey(img: ImageWithId, sort: Exclude<ImageSort, "random" | "name">): string {
  return sort === "rating" ? String(img.rating) : String(img.committedAt);
}

/** Fisher-Yates 洗牌。 */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
