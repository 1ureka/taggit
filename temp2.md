# API 全面重新設計

> 整個 `src/routes/api/` 刪除重寫。設計以「資源怎麼切分才對」為準，不遷就任何現有呼叫端；
> 端點消失或重組時一律改前端。

---

## 一、確定的設計決策

| # | 決策 | 說明 |
|---|---|---|
| 1 | 資源切成 `/api/files` 與 `/api/records` | 一個檔名同時是「磁碟上的檔案」與「資料庫裡的紀錄」兩種資源，各自有完整生命週期，不該擠在同一組 URL |
| 2 | 批次 = 集合層動詞 + **以 id 為鍵的 body**，`null` = 移除 | JSON 物件的鍵天生唯一 → 「同一 id / 同一標籤同時只能有一種操作」由結構保證，端點不再依賴呼叫端的不變量 |
| 3 | 拿掉 `{ ok, data }` 封包 | 成功直接回資源本身 |
| 4 | 錯誤一律 `error(status, message)` → body `{ message }` | 與 SvelteKit 自己的 404 / 500 同形；`request.ts` 的 `formatApiError` 整段消失 |
| 5 | 匯入保留 SSE | 唯一回 `text/event-stream` 的端點 |
| 6 | 計數走 `POST /api/tags/counts` | 只回數字；個別計數與聯集張數輸入相同（一組標籤名），合成同一個資源 |
| 7 | 刪掉 `/api/perf` | 診斷用、非資源、無前端使用；日後要量測用 `test/core/` 的載入器寫臨時腳本 |
| 8 | 「圖片集是否就緒」的守衛**每支端點自己寫** | 不提取。理由：抽成 `requireCollection()` 之後，權威到底是 collection、database 還是 utils 會變得不明確 |

### 關於決策 8 的一個例外，以及為什麼它不牴觸

`MutationError → { HTTP 狀態碼, 人類可讀訊息 }` 的對映**會**提取成一個共用函式，放在 `$lib/utils/server.ts`（該檔案的既有職責就是「API 路由共用的伺服器端輔助函式」，且已經有 `errorToHttp`）。

差別在於：
- 就緒守衛牽涉 `Collection` / `Database` / `ImageLibrary` **三個模組**，抽出來會讓「誰是權威」失焦 → 不抽。
- 錯誤對映只依賴 `$lib/mutation` 的錯誤型別**一個來源**，權威毫無疑問 → 抽。

目前這段對映散落在 **5 個地方**（`request.ts` 的 `formatApiError`、3 支 proto 端點各自的 `errorMessage`、`utils/server.ts` 的 `errorToHttp`），且彼此的中文措辭已經不一致。收斂成一份。

---

## 二、端點總表

12 支路由檔、31 個 handler（現況 17 檔 / 24 handler）。

```
src/routes/api/
├── collection/+server.ts               GET  PUT
├── collection/backup/+server.ts        GET
├── cache/+server.ts                    GET  DELETE
├── files/+server.ts                    GET  POST
├── files/[name]/+server.ts             GET  DELETE
├── records/+server.ts                  GET  POST  PUT  PATCH
├── records/[id]/+server.ts             GET  POST  PUT  PATCH  DELETE
├── tags/+server.ts                     GET  PATCH
├── tags/counts/+server.ts              POST
├── tags/[name]/+server.ts              GET  PATCH  DELETE
├── maintenance/orphans/+server.ts      GET  DELETE
└── maintenance/metadata/+server.ts     GET  PATCH
```

### 貫穿全部端點的規則

1. **成員層動詞對一筆做，集合層同一個動詞對多筆做。** 集合層的 body 一律是 `{ "<id>": <成員層 body> }`，回應是 `{ "<id>": { ok: true } | { ok: false, message } }`，鍵與請求完全對齊。
2. **集合層 PATCH 的 `null` ≡ 對該成員 DELETE。**
3. **除了二進位、ZIP、SSE，所有回應都有 JSON body**（含 DELETE），這樣 `request.ts` 不必處理空 body。
4. **任何失敗都是 `error(status, "中文訊息")`**，body 恆為 `{ message }`。
5. **業務驗證一律下放 `$lib/mutation`**，端點只做 HTTP ↔ 領域的形狀轉換與檔案側前置檢查（檔名安全、副檔名、檔案存在）。

---

## 三、逐支端點契約

### `/api/collection` — 圖片集

**`GET`**（不需要就緒）
```json
{ "root": "D:/pics", "name": "pics", "loaded": true }
```
`loaded = Database.isLoaded() && ImageLibrary.isActive()`。
刻意不回 `valid`：`Collection.isValid()` 會**建立 images/ 子目錄**，GET 不該有副作用。

**`PUT`** body `{ root: string }`
- 非字串 / trim 後為空 → `400 無效的圖片集路徑`
- `Collection.isValid()` 為 false → `422 路徑不存在或無法建立所需的子目錄`
- 成功 → `setPersistedRoot` + `setActiveRoot` + `Database.ensureLoaded` + `ImageLibrary.ensureActive`，回 `{ root, name, loaded: true }`

> 取代 `GET/POST /api/settings/setup`。動詞改 PUT：這是對「唯一的圖片集設定」做整體覆寫，不是建立新成員。

---

### `/api/collection/backup` — 備份

**`GET`**
- 未就緒 → `503 尚未載入圖片集`
- `Database.flush()` → 壓縮 → `application/zip` + `Content-Disposition`
- 壓縮失敗 → `500 系統缺少壓縮工具或權限不足，無法建立備份`

> 動詞由 POST 改 GET：備份是「以 ZIP 形式取得圖片集的一種表示」，不建立任何伺服器端資源。

---

### `/api/cache` — 縮圖快取

**`GET`** → `{ entries, bytes }`
**`DELETE`** → `{ cleared: number }`

> 不加就緒守衛：`ImageLibrary.stats()` / `clear()` 在未綁定目錄時本來就安全。

---

### `/api/files` — 實體檔案

**`GET`** `?state=staged|committed|all`（預設 `all`）
- 未就緒 → 503
```json
{ "items": [{ "name": "a.jpg", "committed": true }], "total": 1 }
```

**`POST`**（multipart，欄位名 `files`）
- 未就緒 → 503
- 非 multipart / 解析失敗 / 沒有任何檔案 → 400
- 200，逐筆結果**以陣列 index 對齊上傳順序**：
```json
{ "results": [
  { "ok": true,  "name": "a.png", "id": "a_1.png" },
  { "ok": false, "name": "b.txt", "message": "不支援的檔案格式" }
] }
```

> 這是全專案**唯一**用陣列而非 keyed map 的批次回應。理由：上傳當下 id 尚未存在（伺服器用 `uniqueFilename` 決定最終檔名），且同一次上傳可能有兩個同名檔案，沒有可當鍵的東西。這個例外會寫進慣例文件。

---

### `/api/files/[name]` — 單一檔案

**`GET`** `?size=sm|md|xl`（預設 `xl`）`&animated=1`
- 未就緒 → 503 ／ 檔名不安全 → 400 ／ size 不合法 → 400
- 路徑穿越 → 403 ／ 不存在 → 404 ／ 解碼失敗 → 500
- 成功 → 二進位 + `Cache-Control: private, max-age=60`

**`DELETE`**（永久刪除實體檔案）
- 未就緒 → 503 ／ 檔名不安全 → 400
- 已提交（`query.hasImage`）→ `409 請先退回提交，再刪除檔案`
- 不存在 → 404 ／ 檔案被鎖住（EBUSY/EPERM 重試後仍失敗）→ 500
- 成功 → `{ "name": "a.jpg" }`

---

### `/api/records` — 已提交紀錄（集合）

**`GET`** — 吃 `ImageQuery.fromSearchParams()` 的全部參數
```json
{ "items": [ /* ImageWithId */ ], "total": 87, "page": 1, "pages": 1 }
```
> 取代 `/api/proto/committed-query`。`/tags` 的懸停預覽、`/tags/cleanup` 的樣本圖都改用這支。

**`POST`** — 批次提交（僅建立，已存在則該筆失敗）
```json
// 請求
{ "a.jpg": { "name": "…", "tags": ["x"], "rating": 3 } }
// 回應 200
{ "a.jpg": { "ok": true } }
```
逐筆流程：檔名安全 → 是圖片檔 → 檔案存在 → `ImageLibrary.probe` → `mutation.commitRecord`。

**`PUT`** — 批次還原（upsert，匯入用），**回 `text/event-stream`**
```
data: {"event":"progress","current":12,"total":300,"id":"a.jpg","ok":true}
data: {"event":"done","imported":298,"skipped":2,"errors":["…"]}
```
走 `mutation.restoreRecord`（匯入語意是「以檔案為準重建收藏庫」，覆寫既有紀錄是預期行為）。
`done` 只帶彙總而非 results map — 逐筆結果已經在 progress 事件裡逐一送出過了。

**`PATCH`** — 批次更新／退回
```json
// 請求：物件 = 更新，null = 退回
{
  "a.jpg": { "name": "…", "tags": ["x"], "rating": 4, "expectedUpdatedAt": 1712345678901 },
  "b.jpg": null
}
// 回應 200
{ "a.jpg": { "ok": true }, "b.jpg": { "ok": false, "message": "找不到紀錄，可能已被退回" } }
```
> 這一支同時取代 `/api/proto/committed-batch` 的 update 與 revert 兩種 op。原本用 `op: "revert"` 欄位區分、且 TODO 明說「混雜兩種操作」的問題，在 keyed map + `null` 之下自然消失：一個 id 不可能同時出現兩次。

**集合層規則檢查：無。** 每筆的樂觀併發各自獨立，項目之間沒有互相依賴 → 批次迴圈留在端點，不進 mutation。

---

### `/api/records/[id]` — 已提交紀錄（成員）

| 動詞 | 語意 | 對應 mutation | 失敗 |
|---|---|---|---|
| `GET` | 取單筆 | `query.getImage` | 404 |
| `POST` | 提交（建立） | `commitRecord` | 已存在 409、驗證 400 |
| `PUT` | 還原（覆寫） | `restoreRecord` | 驗證 400 |
| `PATCH` | 更新 | `updateRecord` | 404 / 409 stale / 400 |
| `DELETE` | 退回 | `removeRecord` | 404 |

成功一律回該筆 `ImageWithId`（`DELETE` 回 `{ id }`）。
`POST` / `PUT` / `PATCH` / `DELETE` 目前只有 `DELETE` 有前端使用（`/compare` 的取消提交），其餘為對稱而存在。

---

### `/api/tags` — 標籤（集合）

**`GET`** — 同時吃 `ImageWhere`（分面 scope）與 `TagQuery`（名稱、hidden、universe、排序、分頁）
```json
{ "items": [{ "name": "風景", "count": 128, "meta": { "hidden": false } }], "total": 1, "page": 1, "pages": 1 }
```
兩組查詢鍵不衝突（`ImageWhere`: search/includedTags/excludedTags/rating/ratingOp；`TagWhere`: name/hidden/universe；`ListOptions`: sort/order/page/limit），沿用現行行為。

> 一律走 `query.facets()`（scope 內、經 hidden 遮蔽後的可見計數）。**不提供 standalone（全域原始計數）的 GET 入口** — 那個語意由 `POST /api/tags/counts` 涵蓋，不為此發明新查詢參數。

**`PATCH`** — 批次改名／顯隱／刪除
```json
// 請求
{
  "老標籤": { "name": "新標籤" },   // 改名（合併也是改名）
  "劇透":   { "hidden": true },     // 顯隱覆寫
  "垃圾":   null                    // 刪除
}
// 回應 200
{
  "老標籤": { "ok": true },
  "劇透":   { "ok": true },
  "垃圾":   { "ok": false, "message": "有 3 張圖片會因此失去最後一個標籤" }
}
```

**集合層規則檢查：有** → 因此**下放 `$lib/mutation`**（見第四節）：
- 執行順序固定 `刪除 → 改名 → 顯隱`（與前端預覽語意一致：刪除以原名為準，之後才套用改名）。
- 改名目標 `to` 若同時是本次的另一個鍵，且該鍵是刪除或本身也要改名 → 該筆回 `ok: false`，不是整批 400（保留部分成功語意）。

> 這一支取代 `/api/proto/tags-batch`。原本的 TODO：「回傳的 `key` 是裸標籤名，能對上是因為畫布保證同一標籤同時只有一種操作（互斥），這個保證活在呼叫端，端點自己並不知道也沒有驗證」—— 在 keyed map 之下，同一標籤在請求裡就不可能出現兩次，端點不再需要相信任何人。

---

### `/api/tags/counts` — 一組標籤的計數摘要

**`POST`** body `{ names: string[] }`
```json
{
  "counts": { "風景": 128, "夜景": 43, "廢墟": 0 },
  "union": 156
}
```
- `names` 非陣列 → 400；空陣列 → 200 `{ "counts": {}, "union": 0 }`
- `counts` ← `Query.tagCounts()`（已存在）；`union` ← `Query.unionCount()`（已存在），兩者都不需要動 query / query-spec

取代 `/api/proto/tags-impact` 與 `/api/proto/tags-union-count` 兩支。走 POST 是因為 tag-impact 的名稱可能上百個，塞不進 URL（現有 TODO 記載約 440 個中文標籤就會撐爆 Node 預設的 16 KB header 上限）——**這個缺陷隨之消失**。

> 已知取捨：`/api/tags/counts` 是靜態路由，會遮蔽名字剛好叫 `counts` 的標籤在 `/api/tags/{name}` 上的存取。那三支成員端點本來就沒有前端使用、只為對稱存在，且此事會明寫在慣例文件裡。

---

### `/api/tags/[name]` — 標籤（成員）

| 動詞 | 語意 |
|---|---|
| `GET` | 單一標籤 `{ name, count, meta }`；位元圖與 meta 都沒有 → 404 |
| `PATCH` | body `{ name?, hidden? }`；兩者皆缺 → 400。`name` → `renameTag`、`hidden` → `setTagMeta`；回改動後的 `{ name, count, meta }` |
| `DELETE` | `deleteTag`；回 `{ name, affected }` |

全部無前端使用，為對稱而存在。

---

### `/api/maintenance/orphans` — 有紀錄、檔案卻不存在

**`GET`** → `{ "items": ["a.jpg"], "total": 1 }`
**`DELETE`** → `{ "removed": ["a.jpg"] }`

### `/api/maintenance/metadata` — 缺 blurhash 或寬高的紀錄

**`GET`** → `{ "items": ["a.jpg"], "total": 1 }`（現行只回數量，改成與 orphans 對稱回 id 列表）
**`PATCH`** → `{ "repaired": ["a.jpg"] }`

---

## 四、`$lib` 的配套改動

### 4.1 `$lib/mutation` — 新增標籤批次入口

`PATCH /api/tags` 帶有集合層不變量（執行順序、改名目標衝突），這是業務規則，不能留在端點。

```ts
// mutation/tag.ts
export type TagChange = { name?: string; hidden?: boolean } | null;

class TagCommands {
  /**
   * 套用一組以標籤名為鍵的異動。鍵唯一 → 一個標籤只會有一種操作。
   * 順序固定：刪除 → 改名 → 顯隱。
   * 改名目標若同時是本次的另一個鍵且將被刪除或改名，該筆以 Validation 失敗。
   */
  applyChanges(changes: Record<string, TagChange>): Record<string, Result<unknown>>;
}

// mutation/index.ts
class Mutation {
  applyTagChanges(changes: Record<string, TagChange>): Record<string, Result<unknown>>;
}
```

`records` 的批次刻意**不**做對應的下放：那邊每筆完全獨立，沒有集合層規則可放，硬搬進 mutation 只是換個地方寫迴圈。這個不對稱會在慣例文件裡寫明理由。

### 4.2 `$lib/utils/server.ts` — 錯誤對映收斂為一份

```ts
/** 把失敗的 mutation 結果轉成 HTTP 錯誤（狀態碼 + 人類可讀中文訊息），直接擲出 */
export function throwMutationError(e: MutationError): never;

/** 同一份對映的訊息面，供批次端點逐筆收斂成 { ok: false, message } */
export function mutationMessage(e: MutationError): string;
```
- 刪除現有的 `errorJson`。
- `parseBody` 保留但改成擲出 `error(400, "無效的 JSON body")`，不再回 tuple（呼叫端少一層 if）。
- `uniqueFilename`、`log` 不動。

### 4.3 `$lib/utils/request.ts` — 重寫（這是使用者點名要瘦身的檔案）

```ts
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined && body !== null) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);

  if (res.ok) return { ok: true, data: json as T };
  return { ok: false, error: hasKey(json, "message") ? String(json.message) : res.statusText };
}
```

消失的東西：
- `formatApiError`（-25 行，含 5 個 `kind` 的中文對映）
- 拆 `{ ok, data }` 封包的分支（-6 行）
- `ApiResult.status`（全專案沒有任何呼叫端讀它）

保留：`get` / `post` / `put` / `patch` / `del` / `stream`（SSE 保留，錯誤分支改讀 `message`）。新增 `put`。

### 4.4 `$lib/image/client.ts`

`imgSrc()` 產出的 URL 由 `/api/images/{name}` 改為 `/api/files/{name}`，其餘（編碼、size、animated）不變。

---

## 五、前端呼叫端改動

| 檔案 | 改動 |
|---|---|
| `$lib/utils/request.ts` | 重寫（4.3） |
| `$lib/image/client.ts` | `imgSrc` 換路徑 |
| `$lib/components/widgets/TagInput.svelte` | URL 與回應形狀都不變（拆封包後 `res.data` 剛好就是原本的內層），只確認型別 |
| `staged/logic/submit.svelte.ts` | `POST /api/records`，body 與 results 都改 keyed map；刪掉「`filename` vs `id` 不一致」的 TODO |
| `staged/logic/deletion.svelte.ts` | `DELETE /api/files/{name}` |
| `staged/logic/import.svelte.ts` | `PUT /api/records`；SSE 事件的 `filename` 欄位改 `id` |
| `staged/logic/tag-impact.svelte.ts` | `POST /api/tags/counts` 讀 `counts`；刪掉 URL 長度上限的 TODO |
| `committed/logic/submit.svelte.ts` | `PATCH /api/records`，退回改送 `null`，`CommittedBatchItem` 聯集型別整個刪除 |
| `committed/logic/tag-impact.svelte.ts` | 同 staged |
| `compare/logic/revert.svelte.ts` | `DELETE /api/records/{id}` |
| `tags/logic/submit.svelte.ts` | `PATCH /api/tags` keyed map；`toPayload` 由三個陣列改成一張 map；刪掉兩個 TODO |
| `tags/cleanup/logic/submit.svelte.ts` | 同上 |
| `tags/logic/merge-count.svelte.ts` | `POST /api/tags/counts` 讀 `union`；刪掉「一次只能查一組」的 TODO |
| `tags/logic/previews.svelte.ts` | `GET /api/records?…` |
| `tags/cleanup/logic/samples.svelte.ts` | `GET /api/records?…` |
| `settings/logic/collection.svelte.ts` | `PUT /api/collection`，body 鍵由 `collectionRoot` 改 `root` |
| `settings/logic/backup.svelte.ts` | `GET /api/collection/backup`（改用 GET） |
| `settings/logic/cache.svelte.ts` | `DELETE /api/cache` |
| `settings/logic/missing.svelte.ts` | `GET`/`DELETE /api/maintenance/orphans` |
| `settings/logic/metadata.svelte.ts` | `GET`/`PATCH /api/maintenance/metadata`；`missing` 由數字改讀 `total` |

**`+page.server.ts` 的 SSR load 全部不動** —— 它們直接呼叫 `Query`，本來就不經過 HTTP，不屬於本次重設計的範圍。

**因設計改變而失效、會一併刪除的 TODO 註解：**
`api/proto/tags-batch/+server.ts:11`、`api/proto/committed-batch/+server.ts:35`、
`tags/logic/submit.svelte.ts:16,59`、`tags/cleanup/logic/submit.svelte.ts:15,58`、
`staged/logic/submit.svelte.ts:15`、`tags/logic/merge-count.svelte.ts:71`、
`staged/logic/tag-impact.svelte.ts:50`、`committed/logic/tag-impact.svelte.ts:76`。

---

## 六、測試

### 6.1 結論：不需要「另外導出函數」的慣例

已實測驗證（跑完即刪的 `_smoke.mjs`）：

- `test/core/loader.mjs` 的 `ssrLoadModule` **可以直接載入 `+server.ts`**，`@sveltejs/kit` 的 `json` / `error` 在該環境下正常運作。
- handler 只用到 `RequestEvent` 的 `url` / `params` / `request` 三個欄位，測試自己捏一個物件即可。
- `error()` 擲出的 `HttpError` 帶 `.status` 與 `.body.message`，一個 try/catch 就能轉成 `{ status, body }`。

實測輸出：
```
✓ api/tags/+server.ts 可載入且有 GET
  GET 未載入 DB 回應 status=503  body={"ok":false,"error":"尚未載入資料庫"}
  載入 DB 後 status=200          body={"ok":true,"data":{"items":[],"total":0,…}}
  POST status=404                body={"ok":false,"error":{"kind":"not_found"}}
✓ error() 擲出可辨識的 HttpError  (status=503, body={"message":"…"})
```

所以：**邏輯就寫在 `GET` / `POST` 裡，直接測 `GET` / `POST`。** 不引入「導出一個函數再由 handler 呼叫」的間接層。

### 6.2 新增 `test/api/` 領域

```
test/api/
  fixtures.mjs              載入 12 支 +server.ts；建暫存 collection；call() 助手
  collection.suite.mjs      GET / PUT、422 無效路徑
  cache.suite.mjs           GET / DELETE
  files.suite.mjs           列表與 state 篩選、二進位與 size、刪除拒絕已提交、路徑穿越
  records-read.suite.mjs    GET 集合（篩選/排序/分頁）與成員
  records-write.suite.mjs   成員層 POST/PUT/PATCH/DELETE、already_exists、樂觀併發
  records-batch.suite.mjs   keyed map 對映、null 退回、部分成功、逐筆訊息
  tags.suite.mjs            GET facet + scope、PATCH 批次的順序與目標衝突、成員層
  tags-counts.suite.mjs     counts / union / 空陣列 / 不存在的標籤
  maintenance.suite.mjs     orphans 與 metadata 的 GET 與修復
  guards.suite.mjs          未就緒一律 503、檔名不安全一律 400
```

`fixtures.mjs` 提供：
```js
h.call(handler, { url?, params?, body?, form? })  // → { status, body }，捕捉 HttpError
h.freshCollection()                               // 暫存 root + images/ + db.json，綁定三個單例
h.putImage(name)                                  // 合成小張 PNG（複用 test/image/fixtures.mjs 的 sharp 合成手法）
h.seedRecord(id, rec)                             // 繞過 mutation 直接寫真相 + 索引
```

另在既有 repo 領域新增 `test/repo/mutation/tag-changes.suite.mjs`，測 `applyTagChanges` 的執行順序與集合層衝突。

`test/run.mjs` 的 `DOMAINS` 加一筆 `{ name: "api", setup: createApiFixtures, suites: [...] }`。

---

## 七、慣例文件

`docs/svelte_kit_api.md` 目前只有一行 TODO stub，本次一併寫成正式的慣例指導文件：

1. 資源怎麼切（files vs records vs tags；為什麼同一個檔名是兩種資源）
2. 動詞語意（成員層 vs 集合層；批次 = 集合層動詞 + keyed body；`null` ≡ DELETE）
3. 回應格式（無封包；錯誤恆為 `{ message }`；逐筆結果的形狀；上傳用陣列的唯一例外）
4. 為什麼就緒守衛每支自己寫、而錯誤對映可以提取
5. 業務驗證一律下放 mutation，端點只做形狀轉換與檔案側前置檢查；records 批次不下放的理由
6. 端點測試慣例（直接呼叫 handler，不做間接層）
7. 已知取捨：`/api/tags/counts` 遮蔽名為 `counts` 的標籤成員端點

---

## 八、執行順序

每個階段結束都能跑 `npm run check` + `npm run test`。

| 階段 | 內容 |
|---|---|
| 1 | `$lib/mutation` 新增 `applyTagChanges`；`$lib/utils/server.ts` 換成 `throwMutationError` / `mutationMessage`、`parseBody` 改擲出；補 mutation 批次測試 |
| 2 | `rm -r src/routes/api/`，依第三節建立 12 支新端點 |
| 3 | 重寫 `$lib/utils/request.ts`；`imgSrc` 換路徑 |
| 4 | 依第五節逐頁改前端呼叫端，刪掉失效的 TODO |
| 5 | 新增 `test/api/` 領域與 11 支 suite，註冊進 `test/run.mjs` |
| 6 | 寫 `docs/svelte_kit_api.md` |
| 7 | `npm run check` / `npm run test` / `npm run build` 全綠 |

階段 2 到 4 之間專案會處於不可執行狀態（端點已換、前端未改），這是刪除重寫的必然，不做過渡相容層。

---

## 九、需要人工驗收的項目

自動化只涵蓋到型別、後端模組與端點層。以下要請你手動確認：

1. `/staged` — 上傳、編輯草稿、批次提交、單張永久刪除、匯入 JSON 的即時進度條
2. `/committed` — 批次更新、批次退回、更新與退回混在同一次送出、樂觀併發衝突（開兩個分頁改同一張）
3. `/compare` — 單張取消提交
4. `/tags` — 拖曳分區後送出（刪除／改名／合併／顯隱四種混合）、合併區的預估張數、標籤懸停預覽圖
5. `/tags/cleanup` — 排入建議後送出、建議卡片的樣本縮圖
6. `/settings` — 切換圖片集路徑、下載備份 ZIP、清空快取、缺失記錄檢查與刪除、元資料補算
7. 全站圖片顯示（`imgSrc` 換路徑後，sm / md / xl 與 GIF 動畫）
8. 審查彈窗的「全新標籤 / 孤兒標籤」在草稿連續改動時是否正確且不再閃載入中

---

## 十、明確不在本次範圍

- `+page.server.ts` 的 SSR load（不經 HTTP，維持直接呼叫 `Query`）
- `$lib/query`、`$lib/query-spec` 的查詢能力（不新增 `anyTags` 等 OR 條件——聯集需求已由 `POST /api/tags/counts` 的 `union` 涵蓋）
- `$lib/database`、`$lib/image` 的內部實作
- 前端頁面的 UI 與 controller 架構（只改呼叫 API 的那幾行）
