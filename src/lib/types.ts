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
 * 圖片尺寸預設。
 * - `"sm"`：小型縮圖（最大 512×512 像素）
 * - `"md"`：中型縮圖（最大 1024×1024 像素）
 * - `"xl"`：原始尺寸，不經過縮放直接提供
 */
export type ImageSize = "sm" | "md" | "xl";

// ---

/**
 * 伺服器組態。
 * 持久化於專案根目錄的 server.json，記錄使用者指定的收藏庫路徑。
 */
export interface ServerConfig {
  /** 收藏庫根目錄的絕對路徑；`undefined` 表示尚未設定 */
  collectionRoot?: string;
}

/**
 * 由收藏庫根目錄衍生的完整路徑集合。
 */
export interface CollectionPaths {
  /** 收藏庫根目錄 */
  root: string;
  /** 圖片目錄（`<root>/images`） */
  images: string;
  /** 資料庫檔案路徑（`<root>/db.json`） */
  db: string;
}

// ---

/**
 * db.json 的頂層結構。
 * 以 JSON 檔案形式持久化於收藏庫根目錄，
 * 在伺服器啟動時載入記憶體，並透過防抖寫回機制同步至磁碟。
 */
export interface DBData {
  /** 資料庫結構版本號 */
  version: number;
  /** 圖片紀錄對映表，鍵為圖片 ID */
  images: Record<string, ImageRecord>;
}

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
 * 圖片查詢的回傳結果。
 * 包含當前頁的圖片清單以及分頁資訊。
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
}

/**
 * 排序的可用選項
 */
export type SortField = Required<QueryOptions>["sort"];

// ---

/**
 * 標籤的聚合資訊。
 * 用於標籤自動完成與統計介面，依使用次數由多至少排序。
 */
export interface TagInfo {
  /** 標籤名稱 */
  name: string;
  /** 使用該標籤的圖片數量 */
  count: number;
}

// ---

/**
 * 前端 Toast 類型
 */
export type ToastType = "success" | "error" | "info";

/**
 * 前端 Toast CustomEvent 的事件名稱
 */
export type ToastEventName = "toast:add";

/**
 * 前端 Toast CustomEvent 攜帶的資料
 */
export interface ToastPayload {
  type: ToastType;
  message: string;
  duration: number;
}

// ---

/**
 * 進度 Toast 的 start 事件名稱
 */
export type ToastProgressStartEventName = "toast:progress:start";

/**
 * 進度 Toast 的 update 事件名稱
 */
export type ToastProgressUpdateEventName = "toast:progress:update";

/**
 * 進度 Toast 的 done 事件名稱
 */
export type ToastProgressDoneEventName = "toast:progress:done";

/**
 * 進度 Toast start 事件的資料。
 * `resolveId` 用於將建立的 toast ID 回傳給呼叫端。
 */
export interface ToastProgressStartPayload {
  label: string;
  resolveId: (id: number) => void;
}

/**
 * 進度 Toast update 事件的資料
 */
export interface ToastProgressUpdatePayload {
  id: number;
  message: string;
  progress: number;
}

/**
 * 進度 Toast done 事件的資料
 */
export interface ToastProgressDonePayload {
  id: number;
  type: "success" | "error";
  message: string;
  duration: number;
}

/**
 * 前端 Confirm CustomEvent 的事件名稱
 */
export type ConfirmEventName = "confirm:request";

/**
 * 前端 Confirm CustomEvent 攜帶的資料
 */
export interface ConfirmPayload {
  message: string;
  title?: string;
  action?: string;
  resolve: (value: boolean) => void;
}

// ---

/**
 * 帶有寬高屬性的基本物件介面
 */
export type ItemWithSize = { id: string; width: number; height: number };

// ---

/**
 * 一個圖示組件的 props
 */
export type IconProps = {
  /** 圖示大小 (CSS 單位) */
  size?: number | string;
  /** 圖示顏色 (CSS 顏色值) */
  color?: string;
};
