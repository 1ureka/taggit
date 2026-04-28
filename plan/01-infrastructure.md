# 標籤主角基礎建設設計

## 背景

目前專案的查詢基礎建設以圖片為核心：

- `src/lib/types.ts` 定義 `QueryOptions`、`QueryResult`、`SortField`，它們都描述圖片列表。
- `src/lib/utils.ts` 提供 `parseQueryParams()` 與 `buildQueryString()`，同樣以圖片名稱、圖片標籤、評分、圖片排序為語意。
- `src/lib/server/db-query.ts` 的主查詢函式是 `queryImages()`，由首頁、Editor、Compare、Player 與 `/api/committed` 共用。
- 標籤目前只有 `TagInfo`、`getAllTags()` 與 `getTagCount()`，用途偏向自動完成與設定頁管理，不足以支撐「標籤列表本身是一個可搜尋、可篩選、可排序的主資源」。

新設計的目標是讓標籤查詢有一套與圖片查詢對稱、但語意獨立的基礎建設：不要把標籤頁需求硬塞進 `QueryOptions`，也不要讓 `parseQueryParams()` 同時承擔兩種不同資源的 URL 語意。

## 設計原則

1. 標籤仍是衍生資源，不新增持久化的 tag table。資料來源是 `JSONDatabase.data.images` 與既有的 `JSONDatabase.tagIndex`。
2. 新增標籤專用的 type、URL parser、query builder、query function，命名上與圖片查詢平行。
3. `TagInfo` 保留為輕量 `{ name, count }` 型別，供 Autocomplete 與設定頁使用。
4. grid 卡片所需的五張圖片是「預覽樣本」，屬於查詢結果的附加資料，不影響標籤本身的資料模型。
5. 樣本圖片預設應穩定，避免每次 SSR 或 URL 更新都造成卡片內容跳動；真正隨機可以作為明確選項。

## 新增型別

建議在 `src/lib/types.ts` 中新增以下型別，放在 `TagInfo` 附近，讓圖片查詢型別與標籤查詢型別在同一層級並列。

```ts
export type TagSortField = "count" | "name" | "recent" | "random";

export type TagSampleMode = "stable" | "recent" | "random";

export interface TagQueryOptions {
  /** 標籤名稱的子字串搜尋，不區分大小寫 */
  search?: string;
  /** 使用次數下限 */
  minCount?: number;
  /** 使用次數上限 */
  maxCount?: number;
  /** 排序欄位 */
  sort?: TagSortField;
  /** 排序方向 */
  order?: "asc" | "desc";
  /** 頁碼，從 1 開始 */
  page?: number;
  /** 每頁筆數；0 或未指定表示不分頁 */
  limit?: number;
  /** 每個標籤回傳的樣本圖片數；0 表示只要 count，不要樣本 */
  sampleLimit?: number;
  /** 樣本挑選策略 */
  sampleMode?: TagSampleMode;
}

export interface TagImageSample {
  id: string;
  name: string;
  width: number;
  height: number;
  blurhash: string;
}

export interface TagWithSamples extends TagInfo {
  /** 使用該標籤的圖片中最新的提交時間；用於 recent 排序 */
  lastUsedAt: number;
  /** 給標籤卡片顯示的圖片樣本 */
  samples: TagImageSample[];
}

export interface TagQueryResult {
  items: TagWithSamples[];
  total: number;
  page: number;
  pages: number;
}
```

`sampleLimit` 在共用查詢層預設為 `0` 比較好，因為 `/api/tags` 現有消費者只需要輕量清單。新的 `/tags` 頁面與 rich API 呼叫再明確傳入 `sampleLimit: 5`。

## URL Parser 與 Builder

在 `src/lib/utils.ts` 新增 `parseTagQueryParams()` 與 `buildTagQueryString()`，與圖片用的 `parseQueryParams()` / `buildQueryString()` 分開。

建議參數：

| URL key | 型別 | 預設 | 說明 |
| --- | --- | --- | --- |
| `search` | string | `undefined` | 搜尋標籤名稱 |
| `minCount` | int | `undefined` | 使用次數下限 |
| `maxCount` | int | `undefined` | 使用次數上限 |
| `sort` | `count \| name \| recent \| random` | `count` | 排序欄位 |
| `order` | `asc \| desc` | `desc` | 排序方向 |
| `page` | int | `1` | 頁碼 |
| `limit` | int | `0` | 分頁筆數，0 代表全部 |
| `sampleLimit` | int | `0` | API 用；頁面端固定覆寫為 5 |
| `sampleMode` | `stable \| recent \| random` | `stable` | 樣本圖片挑選策略 |

與現有 `parseQueryParams()` 不同，新 parser 不應直接用 type assertion 接收 `sort` 或 `order`；建議用白名單檢查，非法值回到預設。這可以避免 URL 被手改後把不支援的排序值送進 `queryTags()`。

`buildTagQueryString()` 應該像 `buildQueryString()` 一樣刪除自己管理的 key，保留同一 URL 上的非本功能參數。預設值省略，以保持 URL 短而可讀。

## 查詢函式

在 `src/lib/server/db-query.ts` 新增 `queryTags(jsonDB, opts)`，與 `queryImages(jsonDB, opts)` 平行。

建議流程：

1. 從 `jsonDB.tagIndex` 產生候選標籤：`Map<tagName, Set<imageId>>`。
2. 依 `search` 篩選標籤名稱。
3. 依 `minCount` / `maxCount` 篩選使用次數。
4. 計算排序需要的欄位：`count`、`name`、`lastUsedAt`。
5. 依 `sort` / `order` 排序；非 `name` 排序時用 `name` 作為穩定 tie-breaker。
6. 套用分頁。
7. 只對當前頁的標籤挑選樣本圖片，避免在大量標籤時做不必要的 metadata hydration。

樣本挑選建議：

- `stable`：用 `hash(tagName + "\0" + imageId)` 對 image id 排序後取前 N 張。使用者感覺像抽樣，但同一資料集與同一 tag 會穩定顯示。
- `recent`：依圖片 `committedAt` 由新到舊取前 N 張。
- `random`：每次 request 洗牌，僅在使用者明確要求隨機時使用。

`TagImageSample` 只需要卡片顯示圖片與 blurhash 佔位所需欄位：`id`、`name`、`width`、`height`、`blurhash`。不需要把 rating、tags、fileSize 等完整圖片紀錄塞進 tag card。

## 既有輕量 helper 的去留

`getAllTags()` 可以保留，但改成委派給 `queryTags()` 的輕量模式：

```ts
export function getAllTags(jsonDB: JSONDatabase): TagInfo[] {
  return queryTags(jsonDB, {
    sort: "count",
    order: "desc",
    limit: 0,
    sampleLimit: 0,
  }).items.map(({ name, count }) => ({ name, count }));
}
```

`getTagCount()` 可維持目前直接回傳 `jsonDB.tagIndex.size`。標籤 rename/delete 的 mutation 不需要改資料模型，因為它們已經會重建 index 並 invalidate 前端 cache。

## 檔案調整清單

第一階段建議只動以下基礎檔案：

- `src/lib/types.ts`：新增 `TagQueryOptions`、`TagQueryResult`、`TagSortField`、`TagImageSample`、`TagWithSamples`。
- `src/lib/utils.ts`：新增 `parseTagQueryParams()`、`buildTagQueryString()` 與 tag query key list。
- `src/lib/server/db-query.ts`：新增 `queryTags()` 與 tag filtering/sorting/sample helper；讓 `getAllTags()` 可委派。
- `src/lib/client/cache.ts`：若 `/api/tags` GET response 調整為 query result，需要讓 `tagCache` 能讀新格式或明確呼叫 `?sampleLimit=0`。

這些改動建立好後，後端 API 與 `/tags` 頁面都能共用同一組標籤查詢語意。

## 邊界與風險

- 標籤不存在獨立資料表，所以只會列出至少出現在一張已提交圖片上的標籤。
- 使用次數只計算 committed images；staged files 尚未進入資料庫，不計入標籤頁。
- `sampleMode=random` 會導致 SSR 結果不穩定，頁面預設不要使用。
- 若 `minCount > maxCount`，建議回傳空結果，不要自動交換，避免 URL 語意被悄悄改寫。
- `search` 在 `/tags` 中代表標籤名稱搜尋，在 `/` 中代表圖片名稱搜尋。這是 route-local URL 語意，可以接受，但 parser 必須分開。
