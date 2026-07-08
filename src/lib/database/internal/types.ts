/**
 * @file types.ts
 * database 模組的全部公開型別。
 * 經由 {@link ../server.ts} 與 {@link ../client.ts} 以 type-only re-export 對外提供。
 */

/**
 * 已提交圖片的元資料紀錄。
 * 每張圖片在提交至收藏庫時，伺服器會擷取檔案資訊與影像屬性，
 * 連同使用者可編輯的名稱、標籤、評分一併持久化至 db.json。
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
  /** BlurHash 編碼字串，作為圖片載入前的模糊佔位圖；空字串表示無法計算 */
  blurhash: string;
}

/**
 * 帶有唯一識別碼的圖片紀錄。
 * `id` 為檔名（如 `"photo.png"`），同時作為 db.json 中的鍵。
 */
export interface ImageWithId extends ImageRecord {
  /** 圖片的唯一識別碼（= 檔名） */
  id: string;
}

/**
 * 提交或匯入圖片紀錄時，每筆項目所需的使用者可控欄位。
 */
export interface ImportEntry {
  /** 圖片名稱 */
  name: string;
  /** 標籤列表 */
  tags: string[];
  /** 使用者評分；省略時預設為 0 */
  rating?: number;
}

/**
 * 提交圖片時由檔案本身衍生的元資料。
 * 由上層 API 向 image 模組取得後傳入 —— database 模組不 import image 模組，
 * 僅以結構相容的純資料耦合。
 */
export interface FileInfo {
  /** 原始檔案大小（位元組） */
  fileSize: number;
  /** 圖片寬度（像素）；0 表示無法取得 */
  width: number;
  /** 圖片高度（像素）；0 表示無法取得 */
  height: number;
  /** BlurHash 編碼字串；空字串表示無法計算 */
  blurhash: string;
}

// ---

/**
 * 標籤本身的元資料。
 * 所有欄位皆有預設值，db.json 只儲存非預設的部分（稀疏）。
 */
export interface TagMeta {
  /** 隱藏標籤：帶有此標籤的圖片，僅在查詢明確包含此標籤時可見。預設 false。 */
  hidden: boolean;
}

/**
 * db.json 的頂層結構（v2）。
 * 以 JSON 檔案形式持久化於收藏庫根目錄，
 * 在伺服器啟動時載入記憶體，並透過防抖寫回機制同步至磁碟。
 *
 * v1 檔案（無 `tags` 欄位）載入時 `tags` 為空表；
 * 純讀取不觸發改寫，首次異動後寫出即為 v2。
 */
export interface DBData {
  /** 資料庫結構版本號（寫出時固定為 2） */
  version: number;
  /** 圖片紀錄對映表，鍵為圖片 ID */
  images: Record<string, ImageRecord>;
  /** 標籤元資料對映表（稀疏：只存非預設值） */
  tags: Record<string, Partial<TagMeta>>;
}

// ---

/**
 * 圖片列表的統一查詢選項。
 * 所有欄位皆為可選；當 `limit` 大於 0 時啟用分頁，
 * 若 `limit` 為 0 或未指定則回傳所有符合條件的結果。
 */
export interface QueryOptions {
  /** 圖片名稱的子字串搜尋（不區分大小寫） */
  search?: string;
  /** 標籤篩選，須同時符合所有指定標籤（AND 語意） */
  includedTags?: string[];
  /** 標籤篩選，須排除所有指定標籤（NOT 語意） */
  excludedTags?: string[];
  /** 評分篩選的閾值 */
  rating?: number;
  /** 評分比較運算子：大於等於、小於等於、等於 */
  ratingOp?: "gte" | "lte" | "eq";
  /** 排序欄位；`"random"` 會以 Fisher-Yates 洗牌隨機排列 */
  sort?: "committedAt" | "rating" | "name" | "random";
  /** 排序方向 */
  order?: "asc" | "desc";
  /** 頁碼（從 1 開始） */
  page?: number;
  /** 每頁筆數；0 或未指定表示不分頁，回傳全部結果 */
  limit?: number;
}

/**
 * 排序的可用選項
 */
export type SortField = Required<QueryOptions>["sort"];

/**
 * 單一標籤在目前查詢結果下的 facet 計數。
 * `count` = 將該標籤加入 AND 篩選後的結果筆數。
 */
export interface TagFacet {
  /** 標籤名稱 */
  name: string;
  /** 目前結果集中擁有該標籤的圖片數 */
  count: number;
  /** 該標籤是否為隱藏標籤 */
  hidden: boolean;
}

/**
 * 圖片查詢的回傳結果。
 * 包含當前頁的圖片清單、分頁資訊，以及目前篩選下的各標籤 facet 計數。
 */
export interface QueryResult {
  /** 當前頁的圖片清單 */
  items: ImageWithId[];
  /** 符合篩選條件的總筆數 */
  total: number;
  /** 當前頁碼 */
  page: number;
  /** 總頁數 */
  pages: number;
  /** 目前篩選結果下各標籤的命中數（依 count 降冪、name 升冪） */
  facets: TagFacet[];
}

// ---

/**
 * 標籤的聚合資訊。
 */
export interface TagInfo {
  /** 標籤名稱 */
  name: string;
  /** 使用該標籤的圖片數量（受 hidden 遮蔽規則影響） */
  count: number;
}

/**
 * 標籤列表的排序欄位。
 */
export type TagSortField = "count" | "name" | "recent" | "random";

/**
 * 標籤卡片樣本圖片的挑選策略。
 */
export type TagSampleMode = "stable" | "recent" | "random";

/**
 * 標籤列表的統一查詢選項。
 */
export interface TagQueryOptions {
  /** 標籤名稱的子字串搜尋（不區分大小寫） */
  search?: string;
  /** 使用次數下限 */
  minCount?: number;
  /** 使用次數上限 */
  maxCount?: number;
  /** 排序欄位 */
  sort?: TagSortField;
  /** 排序方向 */
  order?: "asc" | "desc";
  /** 頁碼（從 1 開始） */
  page?: number;
  /** 每頁筆數；0 或未指定表示不分頁，回傳全部結果 */
  limit?: number;
  /** 每個標籤回傳的樣本圖片數；0 表示不回傳樣本 */
  sampleLimit?: number;
  /** 樣本圖片挑選策略 */
  sampleMode?: TagSampleMode;
}

/**
 * 標籤卡片顯示用的圖片樣本。
 */
export interface TagImageSample {
  /** 圖片的唯一識別碼（= 檔名） */
  id: string;
  /** 圖片名稱 */
  name: string;
  /** 圖片寬度（像素）；0 表示無法取得 */
  width: number;
  /** 圖片高度（像素）；0 表示無法取得 */
  height: number;
  /** BlurHash 編碼字串 */
  blurhash: string;
}

/**
 * 帶有卡片樣本的標籤查詢項目。
 */
export interface TagWithSamples extends TagInfo {
  /** 該標籤是否為隱藏標籤 */
  hidden: boolean;
  /** 使用該標籤的圖片中最新的提交時間 */
  lastUsedAt: number;
  /** 給標籤卡片顯示的圖片樣本 */
  samples: TagImageSample[];
}

/**
 * 標籤查詢的回傳結果。
 */
export interface TagQueryResult {
  /** 當前頁的標籤清單 */
  items: TagWithSamples[];
  /** 符合篩選條件的總筆數 */
  total: number;
  /** 當前頁碼 */
  page: number;
  /** 總頁數 */
  pages: number;
}

// ---

/**
 * 圖片更新補丁 —— 傳入 updateRecord 以部分更新圖片記錄。
 * 除 `expectedUpdatedAt` 外，所有欄位皆為選填。
 */
export interface UpdatePatch {
  /** 呼叫端最後一次看到的 `updatedAt` 時間戳，用於樂觀併發控制。 */
  expectedUpdatedAt: number;
  /** 替換後的標籤列表。 */
  tags?: ImageRecord["tags"];
  /** 替換後的評分。 */
  rating?: ImageRecord["rating"];
  /** 替換後的圖片名稱。 */
  name?: ImageRecord["name"];
}
