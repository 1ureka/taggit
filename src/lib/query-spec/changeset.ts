/**
 * @file changeset.ts
 * 標籤變更集查詢契約
 */

/** 標籤變更集 */
export type Changeset = {
  /** 待刪除的標籤 */
  deletes: string[];
  /** 重新命名；多個 from 指向同一個 to 即為合併 */
  renames: { from: string; to: string }[];
  /** 設定標籤的隱藏屬性 */
  hidden: { name: string; hidden: boolean }[];
};

/** 變更集提及的單一標籤現況 */
type TagStatus = {
  /** 該標籤使用中或存在元資料 */
  exists: boolean;
  /** 該標籤目前的使用數 */
  count: number;
  /** 該標籤目前是否隱藏 */
  hidden: boolean;
};

/** 變更集套用前的預覽 */
export type ChangesetPreview = {
  /** 變更集提及的每個標籤名的現況 */
  tags: Record<string, TagStatus>;
  /** 每個重命名目標最終預計的使用量 */
  mergedCounts: Record<string, number>;
  /** 每個排程刪除的標籤會使多少張圖片失去最後一個標籤 */
  emptiedBy: Record<string, number>;
  /** 會失去所有標籤的圖片總數 */
  emptiedTotal: number;
};
