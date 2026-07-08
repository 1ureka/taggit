# 業務模組架構 — collection / database / image

本文件定義 2.0.0 的模組邊界、資料夾結構、入口約定與依賴規則。
總覽見 [index.md](./index.md)。

---

## 1. 模組邊界原則

1. **一個模組 = 一個資料夾 = 兩個公開入口**：`server.ts` 與 `client.ts`。
   模組內部實作全部放在該模組的 `internal/` 子資料夾，外部程式碼
   （routes、components、其他模組）一律不得 import `internal/` 內的任何檔案。
2. **不設第三個 shared 入口**。跨環境共用的邏輯（例如查詢參數解析）放在 `internal/`
   的環境中立檔案，由 `server.ts` 與 `client.ts` 各自 import 後，以符合該端使用習慣的
   形式重新輸出：server 端介面直接吃 `URLSearchParams` 並在內部自行解析；
   client 端提供特化的 build / parse / 物件化包裝。型別以 type-only export 從兩個入口
   re-export，不構成執行期依賴。
3. **模組之間不互相 import**。凡是需要同時碰兩個模組的業務
   （提交圖片、匯入、列 staged 檔案、layout 啟動流程），一律上移到
   API route / `+page.server.ts` / `+layout.server.ts` 層組合。
4. **邊界以約定 + 驗收檢查維持**（全域搜尋 `internal/` 的外部 import 必須為零筆），
   本版不引入 lint 工具。

這套約定的直接收益是可測試性：`internal/` 內的函式全部接受顯式狀態參數
（延續現有 `db-query.ts` 把 `JSONDatabase` 當第一參數的作法），不碰模組層級單例；
單例、`globalThis` HMR 保護與 `fs` 副作用集中在 `server.ts` 入口與少數 internal 檔案。
未來引入 vitest 時，直接對 `internal/` 各檔做單元測試、對 `server.ts` 做整合測試即可，
不需要再次重構。

---

## 2. collection 模組

> 職責：管理「當前是哪個 collection」與其目錄結構。
> 它不在意 db.json 內容對不對，但它知道目錄是否存在、有沒有 db.json 與 images/、
> 要不要初始化結構。

```
src/lib/collection/
├─ server.ts
├─ client.ts
└─ internal/
   ├─ config.ts        # server.json 的讀寫（現 server/config.ts 的 read/writeServerJson）
   ├─ structure.ts     # 目錄驗證、images/ 初始化、路徑衍生
   └─ path-history.ts  # localStorage 路徑歷史（現 client/localStorage.ts）
```

**server.ts 介面**

```ts
getCollectionRoot(): string | null          // 讀 server.json
setCollectionRoot(root: string): void       // 寫 server.json
isCollectionValid(root: string): boolean    // 目錄存在性 + 自動建立 images/
getCollectionPaths(root: string): CollectionPaths   // { root, images, db }
```

**client.ts 介面**

```ts
getCollectionPathHistory(): string[]
pushCollectionPathHistory(path: string): string[]
clearCollectionPathHistory(): void
```

路徑歷史屬於「使用者用過哪些 collection」的狀態，因此歸入本模組的 client 端；
未來若改為持久化到 server.json，變更被封在同一個模組內，呼叫端不動。

`CollectionPaths` 型別由本模組定義並 re-export，自 `$lib/types.ts` 移出。

---

## 3. database 模組

> 職責：在給定的 collection db.json 檔案下，處理 JSON ↔ 記憶體元資料的管理
> （查詢、新增、修改、持久化）與溝通（查詢參數的構建與解析）。
> 它不在意 id 是不是檔名、實際圖片存不存在；只要求 id 在同一 collection 內唯一。

```
src/lib/database/
├─ server.ts
├─ client.ts
└─ internal/
   ├─ types.ts         # ImageRecord / TagMeta / QueryOptions / QueryResult / TagFacet …
   ├─ schema.ts        # db.json v1/v2 的解析、驗證、序列化（見 tag-metadata.md）
   ├─ store.ts         # Database 類別：記憶體狀態、dirty、防抖 flush、載入/切換
   ├─ bitmap.ts        # BitSet（Uint32Array 位元圖，見 bitmap-index.md）
   ├─ ordinal.ts       # OrdinalRegistry：字串 ID ↔ 序號、墓碑、壓實
   ├─ facet-index.ts   # FacetIndex：標籤位元圖、評分位元圖、hidden 遮罩的維護
   ├─ query.ts         # 查詢管線：篩選 → hidden → 排序 → 分頁 → facet 計數
   ├─ mutation.ts      # commit / update / remove / renameTag / deleteTag / setTagMeta
   └─ params.ts        # QueryOptions ↔ URLSearchParams（環境中立；現 utils.ts 內容移入）
```

**server.ts 介面**（單例管理也在此，取代 `db-instance.ts`）

```ts
// 生命週期（僅供 layout load / setup endpoint / hooks 使用）
ensureLoaded(dbPath: string): void          // 未載入或路徑不同時載入
isLoaded(): boolean
currentDbPath(): string | null
flush(): void                               // SIGINT / 備份前強制寫盤

// 查詢 —— 直接吃 URLSearchParams，內部呼叫 params.ts 解析
queryImages(params: URLSearchParams): QueryResult        // 含 facets
queryTags(params: URLSearchParams): TagQueryResult
getImage(id: string): ImageWithId | null
hasImage(id: string): boolean
getImageCount(): number
getCommittedIds(): ReadonlySet<string>      // 供上層組合 staged 清單

// 異動
commitImage(id, entry: { name; tags; rating }, file: FileInfo): ImageWithId
updateImage(id, patch: UpdatePatch): ImageWithId          // 樂觀併發，沿用 409
removeImage(id): ImageRecord
renameTag(oldName, newName): number
deleteTag(name): number
setTagMeta(name, meta: Partial<TagMeta>): void            // 見 tag-metadata.md
getTagMeta(name): TagMeta
```

`FileInfo = { fileSize, width, height, blurhash }` 由呼叫端（route 層）向 image 模組取得
再傳入 —— 這就是草稿中「新增圖片需要儲存元資料」的耦合處理：耦合發生在上層 API，
database 本身不知道 image 模組存在，簽名裡只有純資料。

查詢類函式同時提供吃解析後 `QueryOptions` 的多載（page load 需要覆寫選項時使用，
例如 compare 頁強制 `sort: "random", limit: 2`），避免呼叫端反向拼回 query string。

**client.ts 介面**

```ts
// 前端特化的參數包裝（現 utils.ts 的 build/parse 系列移入並收斂）
parseQueryParams(url: URL): QueryOptions
buildQueryString(opts: QueryOptions, base?: URLSearchParams): string
parseTagQueryParams(url: URL): TagQueryOptions
buildTagQueryString(opts: TagQueryOptions, base?: URLSearchParams): string
// + 全部查詢/紀錄型別的 type-only re-export
```

前端大宗用法是 `filterFields` / `editorFilter` 之類「改一個欄位 → 重建 query string → goto」，
client.ts 就以這個形態特化；若實作期間發現值得物件化（如 `FilterState` 類別），
物件化包裝也放在 client.ts，internal 的 `params.ts` 維持純函式。

**單例與生命週期**：`server.ts` 內部維持 `globalThis.__db` 的 HMR 保護與
SIGINT/SIGTERM flush（自 `hooks.server.ts` 呼叫 `flush()`），行為與現制相同；
差異只在外部不再拿得到 `JSONDatabase` 實例 —— `requireDatabase()` 洩漏內部類別的
模式廢除，所有存取都經由上述具名函式，未載入時擲出帶 `status: 503` 的錯誤
（API route 統一轉為現行的 `{ ok: false, error: "尚未載入資料庫" }` 回應）。

---

## 4. image 模組

> 職責：在給定的 collection 目錄下，找到圖檔、壓縮、產生檔案側元資料，
> 並定義前端如何要求圖片（imgSrc）。它不在意這張圖在 db.json 有沒有紀錄。

```
src/lib/image/
├─ server.ts
├─ client.ts
└─ internal/
   ├─ formats.ts       # IMG_EXTS / MIME_TYPES（自 server/config.ts 移入）
   ├─ resources.ts     # LRUCache / TaskPool（現 server/resources.ts）
   ├─ thumbnail.ts     # 縮圖產生（現 server/thumbnail.ts 的 processImage 家族）
   └─ metadata.ts      # blurhash + 尺寸讀取（現 generateMetadata）
```

**server.ts 介面**

```ts
isImageFile(filename: string): boolean               // 副檔名判斷
mimeTypeOf(filename: string): string
listImageFiles(imagesDir: string): string[]          // 目錄中全部圖檔（排序）
getImageBuffer(file, sourcePath, size, animated?): Promise<Buffer>   // 縮圖 + LRU + in-flight 去重
readImageInfo(filePath: string): Promise<FileInfo>   // stat + 尺寸 + blurhash 一次回傳
clearCache(): number
getCacheStats(): { entries: number; bytes: number }
```

`readImageInfo` 合併現行「`fs.statSync` + `generateMetadata`」兩步，
是提交 / 匯入流程對 image 模組的唯一需求面。

**client.ts 介面**

```ts
imgSrc(file: string, size?: ImageSize, animated?: boolean): string
// + ImageSize 型別 re-export
```

`ImageSize` 型別由本模組定義（自 `$lib/types.ts` 移出）。

---

## 5. 上層組合（route / load 層）

模組化後，跨模組業務全部長在使用端，形態如下：

**layout 啟動**（`+layout.server.ts`，行為不變）：

```ts
const root = database.isLoaded() ? currentRoot : collection.getCollectionRoot();
if (!root) redirect("/settings?alert=default");
if (!collection.isCollectionValid(root)) redirect("/settings?alert=error");
database.ensureLoaded(collection.getCollectionPaths(root).db);
```

**staged 清單**（tagger load；現 `helpers.getStagedFiles` 廢除）：

```ts
const files = image.listImageFiles(paths.images)
  .filter((f) => !database.hasImage(f));
```

**提交 / 匯入**（`POST /api/staged/[filename]`、`POST /api/committed`）：

```ts
const info = await image.readImageInfo(filePath);       // image：檔案側元資料
const record = database.commitImage(filename, entry, info);  // database：純紀錄
```

**圖片代理**（`GET /api/images/[filename]`）：collection 提供 paths、
image 提供 buffer / mime，route 只做驗證與回應組裝，不碰 database。

---

## 6. 搬遷對照表

| 現有檔案 | 去向 |
| --- | --- |
| `server/config.ts` | collection `internal/config.ts` + `structure.ts`；`IMG_EXTS`/`MIME_TYPES` → image `internal/formats.ts` |
| `client/localStorage.ts` | collection `internal/path-history.ts`（經 `client.ts` 輸出） |
| `server/db.ts` | database `internal/store.ts` + `schema.ts`（`tagIndex` 相關刪除，改建 facet-index） |
| `server/db-instance.ts` | database `server.ts`（`requireDatabase`/`requirePaths` 廢除） |
| `server/db-query.ts` | database `internal/query.ts`（以 bitmap 管線重寫） |
| `server/db-mutation.ts` | database `internal/mutation.ts`（`addRecord` 一併刪除） |
| `utils.ts` 查詢參數函式 | database `internal/params.ts`（經兩入口輸出） |
| `server/thumbnail.ts` | image `internal/thumbnail.ts` + `metadata.ts`（經 `server.ts` 輸出） |
| `server/resources.ts` | image `internal/resources.ts` |
| `client/api.ts` 的 `imgSrc` | image `client.ts`；`api` 請求工具留在 `client/api.ts` |
| `client/cache.ts` | 刪除，無去向（見 [ssr-data-flow.md](./ssr-data-flow.md)） |
| `server/helpers.ts` | `log`/`parseBody`/`uniqueFilename` 留作通用 server 工具；`getStagedFiles` 刪除（route 層組合取代） |
| `server/validation.ts` | 留在原位（API 層輸入驗證，不屬於任一業務模組） |
| `$lib/types.ts` 查詢/紀錄型別 | database `internal/types.ts`；`ImageSize` → image；`CollectionPaths` → collection；UI 型別留在原檔 |
