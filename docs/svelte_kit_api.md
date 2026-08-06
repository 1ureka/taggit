# API 端點的架構與慣例

`src/routes/api/` 底下的所有端點都遵守本文件。新增或修改端點前先讀完這裡。

---

## 資源怎麼切分

### 一個檔名，兩種資源

這是整份設計的起點。在本專案，`photo.png` 同時是：

- **磁碟上的一個檔案** —— 存在於 `<collection>/images/`，有位元組、有尺寸、可以被瀏覽器顯示。
- **資料庫裡的一筆紀錄** —— 存在於 `db.json`，有名稱、標籤、評分、時間戳。

兩者的生命週期是**分開**的：

| 動作 | 檔案 | 紀錄 |
|---|---|---|
| 上傳 | 建立 | — |
| 提交 | — | 建立 |
| 退回 | — | 刪除 |
| 永久刪除 | 刪除 | 必須已不存在 |

所以它們是兩組資源，不是同一個資源的兩種狀態：

- **`/api/files`** —— 實體檔案。上傳、列出、取二進位、永久刪除。
- **`/api/records`** —— 已提交紀錄。查詢、提交、更新、退回。

「暫存區」不是一種實體，只是「沒有紀錄的檔案」，因此它是 `/api/files?state=staged` 這個**篩選**，不是一組自己的 URL。

> 圖片顯示走 `/api/files/{name}`（見 `$lib/image/client.ts` 的 `imgSrc`）：要的是磁碟上那個檔案的內容，與它有沒有紀錄無關，所以暫存與已提交共用同一組 URL。

### 完整清單

```
/api/collection               GET  PUT                   圖片集設定
/api/collection/backup        GET                        以 ZIP 取得整個圖片集
/api/cache                    GET  DELETE                縮圖快取

/api/files                    GET  POST                  實體檔案（列出 / 上傳）
/api/files/[name]             GET  DELETE                二進位 / 永久刪除

/api/records                  GET  POST  PUT  PATCH      已提交紀錄（查詢 / 批次）
/api/records/[id]             GET  POST  PUT  PATCH  DELETE

/api/tags                     GET  PATCH                 標籤（分面查詢 / 批次）
/api/tags/counts              POST                       一組標籤的計數摘要
/api/tags/[name]              GET  PATCH  DELETE

/api/maintenance/orphans      GET  DELETE                有紀錄、檔案卻不存在
/api/maintenance/metadata     GET  PATCH                 缺 blurhash 或寬高
```

---

## 動詞語意

### 成員層與集合層是同一組動詞

**成員層的動詞對一筆做，集合層的同一個動詞對多筆做。** 規則只有這一條，所以看到集合層的 `PATCH` 就知道它是「批次更新」，不需要再記別的。

| 動詞 | `/api/records/[id]` | `/api/records` |
|---|---|---|
| `POST` | 建立這一筆（已存在 → 409） | 批次建立 |
| `PUT` | 建立或覆寫這一筆 | 批次建立或覆寫 |
| `PATCH` | 更新這一筆 | 批次更新／移除 |
| `DELETE` | 移除這一筆 | —（見下方 `null`） |

`POST` 與 `PUT` 的差別只在「已存在時拒絕還是覆寫」：提交（`POST`）必須擋下重複，匯入（`PUT`）的語意是「以檔案為準重建收藏庫」，覆寫是預期行為。

### 批次的 body 以 id 為鍵

集合層的請求內容一律是 `{ "<id>": <成員層的 body> }`，回應是 `{ "<id>": { ok } }`，**鍵與請求完全對齊**。

```jsonc
// PATCH /api/records
{
  "a.jpg": { "name": "…", "tags": ["x"], "expectedUpdatedAt": 1712345678901 },
  "b.jpg": null
}
// → 200
{
  "a.jpg": { "ok": true },
  "b.jpg": { "ok": false, "message": "找不到目標紀錄" }
}
```

這個形狀不是為了省事，是為了**讓端點不必相信呼叫端**：

- JSON 物件的鍵天生唯一，所以「同一個 id / 同一個標籤同時只能有一種操作」是**結構上的保證**，端點不需要驗證，呼叫端也無從違反。
- 回應的鍵就是請求的鍵，呼叫端不需要想辦法把結果對回請求，也不會有兩筆結果撞在同一個 key 上。

> 這正是舊 `/api/proto/tags-batch` 的病灶：它把刪除／改名／顯隱塞進三個平行陣列、結果卻擠在同一個扁平 `results` 裡，靠「畫面保證同一標籤只會有一種操作」才對得上——而那個保證活在呼叫端，端點自己並不知道。

### 集合層 `PATCH` 的 `null` ≡ 對該成員 `DELETE`

值是物件就是更新，是 `null` 就是移除。因此集合層沒有 `DELETE`——批次移除就是 `PATCH` 帶 `null`，兩種語意不會重複。

好處是「更新一部分、退回一部分」是**一次請求**，而且一個 id 不可能同時落在兩邊。

### 例外：上傳用陣列

`POST /api/files` 是全專案唯一以陣列回報逐筆結果的端點：

```jsonc
{ "results": [
  { "ok": true,  "name": "photo.png", "id": "photo_1.png" },
  { "ok": false, "name": "note.txt",  "message": "不支援的檔案格式" }
] }
```

理由：上傳當下 id 還不存在（最終檔名由伺服器的 `uniqueFilename` 決定），且同一次上傳可能有兩個同名檔案，**沒有任何欄位能安全地當鍵**。索引對齊上傳順序。

---

## 回應格式

### 成功：資源本身，沒有封包

```jsonc
GET  /api/records          → { "items": [...], "total": 87, "page": 1, "pages": 1 }
PATCH /api/records/a.jpg   → { "id": "a.jpg", "name": "…", "tags": [...], ... }
DELETE /api/records/a.jpg  → { "id": "a.jpg" }
```

沒有 `{ ok, data }` 這層封包。`ok` 這件事 HTTP 狀態碼已經說了。

除了二進位（`/api/files/[name]`）、ZIP（`/api/collection/backup`）與 SSE（`PUT /api/records`），**所有回應都有 JSON body**，包括 `DELETE`——這樣前端的 `request.ts` 不必處理空 body。

### 失敗：一律 `error(status, message)`

```ts
import { error } from "@sveltejs/kit";

if (!Database.isLoaded()) error(503, "尚未載入圖片集");
```

body 恆為 `{ "message": "…" }`，與 SvelteKit 自己產生的 404 / 500 同形。訊息在伺服器端就已經是**人類可讀的中文**，前端不需要認得任何錯誤種類。

狀態碼的用法：

| 狀態 | 時機 |
|---|---|
| 400 | 請求本身不合法（檔名不安全、body 不是物件、欄位驗證失敗） |
| 403 | 路徑穿越到圖片集之外 |
| 404 | 目標不存在 |
| 409 | 與現況衝突（已存在、樂觀併發過期、會讓圖片失去最後一個標籤、已提交的檔案不准直接刪） |
| 422 | 語法沒問題但語意上做不到（設定的圖片集路徑不存在） |
| 500 | 非預期失敗（壓縮工具缺失、檔案被鎖住、圖片解碼失敗） |
| 503 | 圖片集尚未就緒 |

`MutationError → { 狀態碼, 訊息 }` 的對映**只有一份**，在 `$lib/utils/server.ts`：

- `throwMutationError(e)` —— 單筆端點用，直接擲出。
- `mutationMessage(e)` —— 批次端點用，填進逐筆的 `message`。

---

## 端點裡該寫什麼、不該寫什麼

### 業務驗證一律下放 `$lib/mutation`

端點只做兩件事：

1. **HTTP ↔ 領域的形狀轉換**（解析查詢參數、把逐筆 `Result` 攤成 `{ ok, message }`）。
2. **檔案側的前置檢查**（檔名安全、副檔名是不是圖片、實體檔案在不在）——這些是 `ImageLibrary` 的事，mutation 看不到檔案系統。

欄位本身的合法性（名稱長度、標籤是否重複、評分範圍、樂觀併發）**一律原樣丟給 mutation**，端點不預判、不補值、不重複驗證。`mutation.commitRecord(id, entry, file)` 的 `entry` 型別就是 `unknown`，這是刻意的。

### 集合層的不變量也在 mutation

`PATCH /api/tags` 的批次帶有**集合層規則**：

- 執行順序固定 `刪除 → 改名 → 顯隱`（刪除以原名為準，之後才套用改名，與畫面預覽一致）。
- 改名目標若同時是本組的另一個鍵、且該鍵將被刪除或本身也要改名，該筆的意圖無法判定，單獨以驗證失敗回報。

這些是業務規則，所以放在 `Mutation.applyTagChanges()`，不在端點。端點只把回傳的 map 轉成 `{ ok, message }`。

**`/api/records` 的批次刻意不這樣做**：那邊每一筆完全獨立（樂觀併發各自檢查），沒有集合層規則可放，硬搬進 mutation 只是換個地方寫迴圈。有不變量才下放，沒有就留在端點——這個不對稱是有意的。

### 就緒守衛每支自己寫

```ts
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");
  // …
};
```

**不要**把它抽成 `requireCollection()` 之類的共用助手。這段檢查同時碰 `Collection`、`Database`、`ImageLibrary` 三個模組；一旦抽進 `$lib/utils`，「圖片集是否就緒的權威是誰」就變得不明確——是 collection 模組？database 模組？還是 utils 自己變成權威了？重複寫三行的成本，遠小於架構上「誰說了算」變模糊的成本。

判準：**這段邏輯的權威來源有幾個模組？**

- 一個 → 可以提取（`MutationError` 的對映只依賴 `$lib/mutation`，所以抽進 `utils/server.ts` 沒問題）。
- 兩個以上 → 每處重複寫。

每支端點要檢查什麼，取決於它真的會用到什麼：

- 只讀資料庫 → `Database.isLoaded()`
- 會碰檔案 → 再加 `ImageLibrary.isActive()`
- 需要 `paths` → 再加 `Collection.getActiveRoot()`

`/api/collection` 與 `/api/cache` **刻意沒有守衛**：前者是設定圖片集的唯一入口，有守衛就沒人設得起來；後者操作的是 `ImageLibrary` 單例自己的快取，未綁定目錄時讀寫也安全。

---

## 測試

### 直接測 `GET` / `POST`，不要間接層

`test/core/loader.mjs` 的 `ssrLoadModule` 可以直接載入 `+server.ts`，`@sveltejs/kit` 的 `json` / `error` 在該環境下正常運作。handler 只用到 `RequestEvent` 的 `url` / `params` / `request` 三個欄位，測試自己捏一個就夠了。

所以**邏輯就寫在 handler 裡**，不需要「另外導出一個函數再由 `GET` 呼叫」的間接層——handler 本身就是可測單位。

```js
const r = await h.call(h.api.records.PATCH, { body: { "a.png": null } });
// → { status: 200, body: { "a.png": { ok: true } } }
```

`h.call()` 會把 `error()` 擲出的 `HttpError` 攤平成 `{ status, body }`，因此「成功回什麼」與「失敗回什麼」在測試裡是同一個形狀。

### 領域佈局

```
test/api/
  fixtures.mjs              載入 12 支端點；freshCollection / call / seedRecord / putImage …
  guards.suite.mjs          逐支確認就緒守衛與檔名安全（守衛是重複寫的，更需要逐支測）
  collection.suite.mjs      /api/collection 與 /api/cache
  files.suite.mjs           列表分群、二進位、上傳、刪除的 409
  records-read.suite.mjs    GET 集合（篩選 / 排序 / 分頁）與成員
  records-write.suite.mjs   成員層四個動詞、樂觀併發、already_exists
  records-batch.suite.mjs   keyed map 對齊、null 退回、SSE 匯入
  tags.suite.mjs            分面查詢、批次的順序與衝突、成員層
  tags-counts.suite.mjs     個別計數與聯集
  maintenance.suite.mjs     兩種整合性問題的檢查與修復
```

`api` 領域在 `test/run.mjs` 排**最後**：它會重設 `Database` / `ImageLibrary` 的 HMR 全域變數來測未就緒的守衛，不該影響其他領域。

業務規則本身在 `test/repo/` 測（例如 `mutation/tag-changes.suite.mjs` 測執行順序與集合層衝突），`test/api/` 只測「HTTP 這一層有沒有把它接對」。

---

## 已知取捨

1. **`/api/tags/counts` 是靜態路由**，會遮蔽名字剛好叫 `counts` 的標籤在 `/api/tags/[name]` 上的存取。那三支成員端點只為對稱存在、沒有前端使用，因此接受。
   （`/api/records/count` 沒有這個問題也不需要，因為紀錄 id 一定帶圖片副檔名。）

2. **`POST /api/tags/counts` 用 POST 做查詢**。標籤影響評估一次可能要查上百個名稱，塞進 URL 會先撞上 Node 預設的 header 長度上限。

3. **`PUT /api/records` 回 `text/event-stream`**，是唯一不回 JSON 的寫入端點。匯入動輒數千筆、每筆都要解碼圖片，必須邊做邊回報進度。

4. **有些端點沒有任何前端使用**（`/api/tags/[name]` 三支、`/api/records/[id]` 的 POST/PUT/PATCH、`GET /api/files`）。它們為了成員層與集合層的對稱而存在，也讓端點可以被單獨測試。

---

## 不屬於本文件範圍

`+page.server.ts` 的 `load` **不是 API 端點**：它直接呼叫 `$lib/query`，不經過 HTTP，也不套用這裡的任何慣例。頁面首屏資料一律走 `load`，不要為了「統一」而改成 fetch 自己的 API。
