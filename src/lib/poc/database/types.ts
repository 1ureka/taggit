/**
 * @file types.ts
 * database 的實體型別。
 *
 * 命令型別（ImportEntry / FileInfo / UpdatePatch…）屬 mutation 模組；
 * 查詢值物件（ImageWhere / ImageQuery…）屬 query-spec 模組；
 * 查詢結果（QueryResult / Tag）屬 query 模組。
 */

/**
 * db.json 的頂層結構（v2），v1 檔案無 `tags` 欄位
 */
export interface DBData {
  /** 資料庫結構版本號 */
  version: number;
  /** 圖片紀錄對映表，鍵為圖片 ID */
  images: Record<string, ImageRecord>;
  /** 標籤元資料對映表，鍵為標籤名稱（稀疏，只存非預設值）*/
  tags: Record<string, Partial<TagMeta>>;
}

/**
 * 已提交圖片的元資料紀錄。
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
 * 帶有識別碼的圖片紀錄。`id` 為檔名（如 `"photo.png"`），也是 db.json 中的鍵。
 */
export interface ImageWithId extends ImageRecord {
  /** 圖片的唯一識別碼（= 檔名） */
  id: string;
}

/**
 * 標籤本身的元資料，所有欄位皆有預設值；db.json 只儲存非預設的部分。
 */
export interface TagMeta {
  /** 隱藏標籤：帶有此標籤的圖片，僅在查詢明確包含此標籤時可見。預設 false。 */
  hidden: boolean;
}
