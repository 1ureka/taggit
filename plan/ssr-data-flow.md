# SSR Faceted Search 資料流 — Tag Cache 刪除與 API 入口變更

本文件定義 2.0.0 的前後端資料流：`createSWR` / `tagCache` 的完全刪除、
以 page load（SSR）為唯一讀取路徑的 faceted search、API 端點存廢，
與前端各消費點的改動。查詢本身的實作見 [bitmap-index.md](./bitmap-index.md)。

---

## 1. 刪除 Tag Cache

刪除項目：

- `src/lib/client/cache.ts` 整檔（`createSWR`、`tagCache`、`fetchTags`）。
- 所有 `tagCache.invalidate()` 呼叫點（tagger、editor、settings 共 7 處）——
  這些呼叫點旁邊本來就有 `invalidateAll()`，刪掉 tagCache 後由 `invalidateAll()`
  單獨負責資料更新，失效機制從兩套收斂為一套。
- `GET /api/tags` 的查詢用途（端點存廢見 §4）。

理由（結論性陳述）：本專案是個人本地 / 局域網使用，不存在多客戶端併發更新的場景，
SWR 的「先回舊資料、背景更新」在這裡只製造過期畫面與雙重失效的維護負擔；
且 faceted search 的標籤計數依當前篩選而變，本質上是「頁面查詢結果的一部分」，
不是可全域快取的獨立資源。SSR page load 天然攜帶正確的 facet 資料，client cache 無存在空間。

---

## 2. 資料流（目標型態）

**讀取**：一律 SSR。篩選 / 排序 / 分頁的唯一真相是 URL query string。

```
使用者操作篩選 UI
  → filterFields / editorFilter 以 database/client.ts 的 buildQueryString 重建 query
  → goto(pathname + query, { replaceState, noScroll, keepFocus })
  → +page.server.ts 執行 database/server.ts 的 queryImages(url.searchParams)
  → 回傳 { items, total, page, pages, facets }
  → 頁面元件、篩選欄、自動完成全部從 page data 讀取
```

**異動**：一律走既有 mutation API（POST / PATCH / DELETE），成功後 `invalidateAll()`
重跑所有 load，facet 計數與列表同步更新。此模式現已存在，2.0.0 不改變它，
只是移除它旁邊的第二套快取。

**各頁面 load 的回傳**（在現有基礎上統一補上 `facets`）：

| 頁面 | load 呼叫 | 回傳 |
| --- | --- | --- |
| `(home)` | `queryImages(searchParams)` | `{ items, total, facets }` |
| `player` | `queryImages(searchParams)`（空結果轉導回 home，不變） | `{ images, total, facets }` |
| `compare` | `queryImages(opts 覆寫 { sort:"random", limit:2 })` | `{ pairs, total, facets }` |
| `editor` | `queryImages(opts 覆寫 { limit: 0 })` + `getImage` | `{ committedFiles, currentRecord, facets }` |
| `tagger` | `image.listImageFiles` × `database.hasImage` 組合 staged 清單；另回傳全量 facets（tagger 無篩選條件，facets = 全庫標籤計數，供自動完成） | `{ stagedFiles, facets }` |
| `settings` | 不依賴已載入 collection，維持現制 | 不變 |

`(home)` 的標籤瀏覽卡片（browse modal）改由 `queryTags` 的 SSR 提供：
瀏覽狀態同樣進 URL query（`buildTagQueryString` 已具備），load 內依參數呼叫 `queryTags`。

---

## 3. 自動完成（Autocomplete）改造

現制：`ui/autocomplete.svelte.ts` 在攔截輸入時自行 `await tagCache.get()`。

改為：候選標籤由建構端注入 —— 元件 / 控制器增加 `tags: TagFacet[]`（或 getter）參數，
各頁面把 page data 的 `facets` 傳進來。效果：

- 自動完成候選自動反映當前篩選語境（faceted：已被篩掉的標籤 count 為 0 / 不出現）；
- tagger / editor 表單場景傳入全量 facets（tagger load 提供、editor 以 `limit: 0` 全量查詢的 facets 即全庫計數）；
- `ui/autocomplete.svelte.ts` 變成純 UI 元件，不再有網路副作用，符合模組邊界原則。

hidden 標籤在 facets 中帶有 `hidden: true` 旗標，自動完成照常列出
（使用者必須能主動輸入 hidden 標籤來檢視這些圖片），由 UI 自行決定是否加註樣式（本版不做樣式）。

---

## 4. API 入口存廢表

**刪除**（讀取職責全數由 SSR page load 接手；以下端點目前已無前端呼叫者，或唯一呼叫者一併刪除）：

| 端點 | 現況 | 處置 |
| --- | --- | --- |
| `GET /api/committed` | 無前端呼叫者 | 刪除 |
| `GET /api/committed/[filename]` | 無前端呼叫者 | 刪除 |
| `GET /api/tags` | 唯一呼叫者 = `tagCache` | 刪除（同檔的 POST / DELETE 保留） |
| `GET /api/staged` | 無前端呼叫者（tagger 用 load） | 刪除（同檔的 POST 保留） |

**保留**（mutation 與二進位 / 工具端點），一律改為呼叫新模組：

| 端點 | 說明 | 2.0.0 改動 |
| --- | --- | --- |
| `POST /api/committed` | 匯入（SSE 進度串流） | route 層組合 `image.readImageInfo` + `database.commitImage`；SSE 形態不變 |
| `PATCH /api/committed/[filename]` | 編輯（樂觀併發） | 轉呼叫 `database.updateImage` |
| `DELETE /api/committed/[filename]` | 取消提交 | 轉呼叫 `database.removeImage` |
| `POST /api/staged` | 上傳檔案 | 轉呼叫 collection paths + image 的檔名 / 格式判斷 |
| `POST /api/staged/[filename]` | 提交 | route 層組合 image + database（同匯入） |
| `DELETE /api/staged/[filename]` | 刪除暫存檔 | 轉呼叫 image / database 判斷後 unlink |
| `POST /api/tags` | 標籤改名 | 轉呼叫 `database.renameTag`（含元資料搬移，見 [tag-metadata.md](./tag-metadata.md)） |
| `DELETE /api/tags` | 標籤刪除 | 轉呼叫 `database.deleteTag`；「最後一個標籤」的 409 檢查移入 database 模組 |
| **`PATCH /api/tags`（新增）** | 設定標籤元資料 | Body `{ name, hidden }` → `database.setTagMeta`；僅後端，前端 UI 非本版範圍 |
| `GET /api/images/[filename]` | 圖片二進位 | 轉呼叫 image 模組（縮圖 / 原圖串流 / MIME） |
| `/api/settings/*`（setup / missing / metadata / cache / backup） | settings 頁工具 | 全部保留（settings 頁必須在 collection 未載入時可用，維持 client 觸發），內部轉呼叫新模組 |

**回應格式**：`{ ok, data | error }` 封包與各狀態碼（400 / 404 / 409 / 503）不變，
`client/api.ts` 的 `api` 請求工具不變。

---

## 5. 前端改動清單

| 檔案 | 改動 |
| --- | --- |
| `lib/client/cache.ts` | 刪除 |
| `lib/ui/autocomplete.svelte.ts` | 移除 `tagCache` import，改為注入 `tags`（§3） |
| `routes/tagger/taggerForm.svelte.ts`、`taggerList.svelte.ts` | 移除 `tagCache.invalidate()`；staged 資料流不變（load 供給） |
| `routes/editor/editorFormActions.svelte.ts` | 移除 `tagCache.invalidate()` × 3 |
| `routes/settings/settingsTagRename.svelte.ts` | 移除 `tagCache.invalidate()` × 2 |
| `lib/ui/filterFields.svelte.ts`、`routes/editor/editorFilter.svelte.ts` | import 路徑改為 `database/client.ts`；行為不變 |
| 各 `+page.server.ts` | 改呼叫 `database/server.ts` / route 層組合；回傳補 `facets` |
| 所有 `imgSrc` 呼叫點 | import 路徑改為 `image/client.ts` |
| `+layout.server.ts`、`hooks.server.ts` | 改用 collection / database 新入口（見 [architecture.md](./architecture.md) §5） |

---

## 6. 行為驗證要點

- 篩選欄輸入標籤 → URL 更新 → SSR 重查 → 自動完成候選計數隨之變動（faceted 行為的直接證據）。
- tagger 提交成功 → `invalidateAll()` → staged 清單縮短、自動完成含新標籤 —— 全程無 client cache。
- settings 改名標籤 → 回到 home，篩選欄舊標籤消失、新標籤可查。
- 斷網以外的錯誤路徑（503 未載入、409 併發衝突）回應與現版一致。
