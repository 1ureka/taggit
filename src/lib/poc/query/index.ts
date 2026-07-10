/**
 * @file poc/query/index.ts
 * 執行器的公開入口 —— 只匯出 `Query` class（＋結果型別 QueryResult / Tag）。
 *
 * `Query` 建構時注入 db（authority-free，可注入假 db 測試），並造出共用 ScopeResolver
 * 與兩個引擎；`images` / `tags` 只是把值物件轉交對應引擎。子檔不對模組外露出。
 *
 * faceted 頁 = 同一個 ImageWhere 各建 ImageQuery 與 TagFacetQuery，對同一個 Query 實例
 * 分別呼叫 images / facets（兩引擎不互傳結果）；獨立標籤列表則走 tags(TagQuery)。
 */

import type { Database, ImageWithId } from "../database/index.js";
import type { ImageQuery, TagFacetQuery, TagQuery } from "../query-spec/index.js";
import { ScopeResolver } from "./scope.js";
import { ImageEngine } from "./images.js";
import { TagEngine } from "./tags.js";
import type { QueryResult, Tag } from "./types.js";

export type { QueryResult, Tag } from "./types.js";

export class Query {
  private imageEngine: ImageEngine;
  private tagEngine: TagEngine;

  constructor(private db: Database) {
    const scope = new ScopeResolver(db);
    this.imageEngine = new ImageEngine(db, scope);
    this.tagEngine = new TagEngine(db, scope);
  }

  /** 圖片查詢引擎：篩選 + hidden 遮蔽 + 排序 + 分頁。 */
  images(q: ImageQuery): QueryResult<ImageWithId> {
    return this.imageEngine.run(q);
  }

  /** 獨立標籤列表：count = 原始總使用數，不遮蔽 → 排序 → 分頁。 */
  tags(q: TagQuery): QueryResult<Tag> {
    return this.tagEngine.runStandalone(q);
  }

  /** faceted 標籤：scope 篩選 + hidden 遮蔽後計數 → 排序 → 分頁。 */
  facets(q: TagFacetQuery): QueryResult<Tag> {
    return this.tagEngine.runFacet(q);
  }

  /** 取得單張圖片（含 id），找不到回 `null`。 */
  getImage(id: string): ImageWithId | null {
    const rec = this.db.getImage(id);
    return rec ? { id, ...rec } : null;
  }

  /** 全部圖片紀錄（含 id），不套篩選、不遮蔽。僅供維護掃描用。 */
  getAllImages(): ImageWithId[] {
    return this.db.imageEntries().map(([id, rec]) => ({ id, ...rec }));
  }

  /** 已提交圖片的總數（不受 hidden 遮蔽影響的原始數量）。 */
  getImageCount(): number {
    return this.db.imageCount();
  }

  /** 檢查是否存在指定 id。 */
  hasImage(id: string): boolean {
    return this.db.hasImage(id);
  }
}
