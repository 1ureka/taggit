/**
 * @file poc/query/index.ts
 * 查詢執行器的公開入口
 */

import type { Database, ImageWithId } from "$lib/poc/database";
import type { ImageQuery, TagFacetQuery, TagQuery } from "$lib/poc/query-spec";

import { ScopeResolver } from "./scope";
import { ImageEngine } from "./images";
import { TagEngine } from "./tags";
import type { QueryResult, Tag } from "./types";

export type { QueryResult, Tag } from "./types";

export class Query {
  private imageEngine: ImageEngine;
  private tagEngine: TagEngine;

  /** 建構時注入 db ，並造出共用 ScopeResolver 待命 */
  constructor(private db: Database) {
    const scope = new ScopeResolver(db);
    this.imageEngine = new ImageEngine(db, scope);
    this.tagEngine = new TagEngine(db, scope);
  }

  /** 執行圖片紀錄查詢 */
  images(q: ImageQuery): QueryResult<ImageWithId> {
    return this.imageEngine.run(q);
  }

  /** 執行標籤列表查詢 */
  tags(q: TagQuery): QueryResult<Tag> {
    return this.tagEngine.runStandalone(q);
  }

  /** 執行分面標籤列表查詢 */
  facets(q: TagFacetQuery): QueryResult<Tag> {
    return this.tagEngine.runFacet(q);
  }

  /** 查詢單張圖片（含 id），找不到回 `null`。 */
  getImage(id: string): ImageWithId | null {
    const rec = this.db.getImage(id);
    return rec ? { id, ...rec } : null;
  }

  /** 查詢全部圖片紀錄（含 id）。僅供維護掃描用。 */
  getAllImages(): ImageWithId[] {
    return this.db.imageEntries().map(([id, rec]) => ({ id, ...rec }));
  }

  /** 查詢已提交圖片的總數（不受 hidden 遮蔽影響的原始數量）。 */
  getImageCount(): number {
    return this.db.imageCount();
  }

  /** 檢查是否存在指定 id。 */
  hasImage(id: string): boolean {
    return this.db.hasImage(id);
  }
}
