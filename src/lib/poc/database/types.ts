/**
 * @file types.ts
 * database 引擎的核心實體型別（真相 write model）。
 *
 * 只放「引擎持有的真相」相關型別：db.json 結構、圖片紀錄、標籤元資料。
 * 命令型別（ImportEntry / FileInfo / UpdatePatch…）屬 mutation 模組；
 * 查詢值物件（ImageWhere / ImageQuery…）屬 query-spec 模組；
 * 查詢結果（QueryResult / Tag）屬 query 模組。分界見 plan-db/index.md。
 */

/**
 * db.json 的頂層結構（v2）。
 *
 * v1 檔案（無 `tags` 欄位）載入時 `tags` 為空表；
 * 純讀取不觸發改寫，首次異動後寫出即為 v2。
 */
export interface DBData {
  /** 資料庫結構版本號（寫出時固定為 2） */
  version: number;
  /** 圖片紀錄對映表，鍵為圖片 ID（真相，完整型別） */
  images: Record<string, ImageRecord>;
  /**
   * 標籤元資料對映表（真相，稀疏儲存：只存非預設值）。
   * 稀疏是**序列化格式**、引擎內部細節；對外的讀寫原語一律以完整
   * {@link TagMeta} 進出（見 Database.getTagMeta / setTagMeta）。
   */
  tags: Record<string, Partial<TagMeta>>;
}

/**
 * 已提交圖片的元資料紀錄（真相，完整型別）。
 */
export interface ImageRecord {
  /** 使用者可編輯的圖片名稱 */
  name: string;
  /** 使用者指派的標籤列表 */
  tags: string[];
  /** 使用者評分，範圍 0–5；0 表示未評分 */
  rating: number;
  /** 圖片首次提交至收藏庫的時間戳（Unix 毫秒），提交後不再變動 */
  committedAt: number;
  /** 元資料最後更新的時間戳（Unix 毫秒），用於樂觀並行控制的衝突偵測 */
  updatedAt: number;
  /** 原始檔案大小（位元組） */
  fileSize: number;
  /** 圖片寬度（像素）；0 表示無法取得 */
  width: number;
  /** 圖片高度（像素）；0 表示無法取得 */
  height: number;
  /** BlurHash 編碼字串；空字串表示無法計算 */
  blurhash: string;
}

/**
 * 帶有唯一識別碼的圖片紀錄。`id` 為檔名（如 `"photo.png"`），同時作為 db.json 中的鍵。
 *
 * 真相原語（Database.getImage）以不帶 id 的 {@link ImageRecord} 進出；
 * 「id 是身份、record 是內容」的組裝由讀取端（query）與寫入端（mutation）負責。
 */
export interface ImageWithId extends ImageRecord {
  /** 圖片的唯一識別碼（= 檔名） */
  id: string;
}

/**
 * 標籤本身的元資料（真相，完整型別）。
 * 所有欄位皆有預設值；db.json 只儲存非預設的部分（稀疏），
 * 但對外的讀寫原語一律以此完整型別進出。
 */
export interface TagMeta {
  /** 隱藏標籤：帶有此標籤的圖片，僅在查詢明確包含此標籤時可見。預設 false。 */
  hidden: boolean;
}
