# 4. 切換 collection 時清空快取

> 切換 collection 時，應該要清空快取。

## 目標

切換到不同的 collection 時，清空 image 模組的記憶體圖片快取，避免上一個 collection 的縮圖 / WebP 結果殘留、被下一個 collection 誤用。

## 現況

- image 快取：記憶體內、模組層級的縮圖 / WebP 快取，經 `clearCache()` 清空、`getCacheStats()` 查詢（[image/server.ts](../src/lib/image/server.ts) → `internal/thumbnail.ts`）。目前只有兩處會清：設定頁「清空快取」按鈕、伺服器重啟。
- 切換 collection 的路徑：
  1. `POST /api/settings/setup`（[api/settings/setup/+server.ts](../src/routes/api/settings/setup/+server.ts)）：`setCollectionRoot` → `setActiveRoot` → `database.ensureLoaded(paths.db)`。**未清快取。**
  2. layout 啟動流程（[+layout.server.ts](../src/routes/+layout.server.ts)）：`setActiveRoot` + `ensureLoaded`。
- 資料庫切換：`Database.loadCollection`（[store.ts](../src/lib/database/internal/store.ts)）在 `ensureLoaded` 偵測到 `currentDbPath` 改變時整體重載——**DB 已正確換 collection，但 image 快取沒跟著清**。

### 為何是正確性問題

快取鍵若以檔名（如 `photo.png`）為主，兩個 collection 各有同名不同內容的檔案時，切換後可能回舊圖。即使目前鍵含更多資訊，切換 collection 後舊 collection 的快取項也只是佔記憶體、無用。**先確認快取鍵是否含 collection 路徑**（讀 `internal/thumbnail.ts`）——若鍵不含 root，則此項為必要修正；若已含 root，仍建議清除以釋放記憶體。

## 實作步驟

### 方案 A（建議）：在 collection 切換的單一收斂點清快取

image 模組不應被 collection 模組 import 其 internal，但可在**路由層**組合（與現有 `commitImage` 由 route 組合 image×database 的模式一致）。

- 在 `POST /api/settings/setup` 端點，於偵測到 root 改變並套用後呼叫 `image.clearCache()`：
  - 判斷是否「切換」：比較新 root 與切換前的 `collection.getActiveRoot()`；不同才清（同一個 root 重複儲存不必清）。
  - import `import { clearCache } from "$lib/image/server.js"`，在 `setActiveRoot(root)` 後、回應前呼叫。
- 同步檢查 layout 啟動流程：正常啟動只會設定一次 active root，不算「切換」，不需要清；但若未來允許在不重啟下切換，建議把「切換即清快取」收斂到一處共用函式。

### 方案 B：把清快取收斂進 collection 模組

在 `collection.server` 提供 `switchCollection(root)`，內部負責 `setCollectionRoot` + `setActiveRoot` + 回傳是否為切換，讓呼叫端據以 `ensureLoaded` + `clearCache`。較整潔但改動面較大。MVP 採方案 A。

## 需要決策

- **先讀 `internal/thumbnail.ts` 確認快取鍵是否已含 collection root**，以判定這是「正確性修復」還是「記憶體衛生」。兩種情況都建議清，但敘述與測試重點不同。
- **要不要順帶處理 layout 首次載入**：目前無「不重啟切換」路徑會經 layout 造成髒快取，故 MVP 只需覆蓋 setup 端點。

## 風險 / 注意

- 清快取是安全操作（快取本就可重建），代價是切換後首次載圖較慢，可接受。
- 確保只在「確實換了 root」時清，避免每次儲存同路徑都清空（雖無正確性問題，但浪費）。

## 驗收

- 準備兩個 collection，其 `images/` 內含同名但不同內容的檔案。
- 於瀏覽頁載入 A 的縮圖（進快取）→ 設定頁切到 B → 回瀏覽頁：顯示的是 B 的圖，非 A 的殘影。
- 設定頁「圖片快取」統計在切換後歸零（或僅含 B 的項目）。
