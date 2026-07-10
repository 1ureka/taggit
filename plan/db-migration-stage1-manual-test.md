# 第一階段手動測試清單

## 1. 建立全新 collection（settings）

- [x] 開 `/settings`，在 collection path 填一個**全新的空資料夾**路徑，儲存。
- [ ] 預期：成功切換；側欄顯示 committed 0 / staged 0；首頁為空清單。
- [ ] 錯誤路徑：填一個不存在且無法建立的路徑 → 422「路徑不存在或無法建立所需的子目錄」。

## 2. 放入圖片（檔案系統）

- [ ] 手動丟 5–10 張圖到 `<collection>/images/`。
- [ ] 回到 app（任一頁重新整理）→ 側欄 staged 數量 = 丟入張數。

## 3. tagger 匯入

- [ ] 開 `/tagger`，逐張（或匯入 JSON）給名稱、標籤（至少兩種標籤、部分共用）、評分後提交。
- [ ] 預期：每張成功後從 staged 清單消失；側欄 committed/staged 數字同步變化。
- [ ] 錯誤路徑（可用 devtools 直接 `fetch` 驗）：
  - [ ] `POST /api/staged/<已提交的檔名>` → 409 字串「已提交的圖片」。
  - [ ] `POST /api/staged/<檔名>` body `{ "tags": [] }` → 400 `validation`，`fields: ["tags"]`。
  - [ ] `POST /api/staged/<檔名>` body `{ "tags": ["a"], "rating": 9 }` → 400 `validation`，`fields: ["rating"]`。
  - [ ] 省略 `rating` → 成功且評分為 0（新行為：rating 選填，預設 0）。
  - [ ] 匯入 JSON 走 `POST /api/committed`（SSE）：混入一筆壞紀錄（如 tags 空陣列）→
        該筆 progress `ok: false`、error 為「標籤不合法 (tags)」，其餘正常匯入。

## 4. home 瀏覽 + 篩選

- [x] 開 `/`，確認全部圖片出現、facet 側欄的標籤計數正確。
- [x] 加一個 includedTags 篩選 → 清單縮小、facet 計數跟著 scope 變化、URL 帶 `includedTags=`。
- [ ] 名稱搜尋、評分篩選（≥ / ≤ / =）、排序切換（時間/評分/名稱/隨機）、升降冪都動一輪。
- [ ] 重點：換任何篩選條件後 `page` 回到 1；URL 上非預設值才出現（乾淨網址）。
- [ ] 點圖開 modal → 點「在 editor 開啟」→ editor 帶著同樣篩選 + currentId 開啟。

## 5. editor 編修

- [ ] 單張：改名稱 / 加減標籤 / 改評分 → Ctrl+S 存檔 → toast「已存檔」，清單即時更新。
- [ ] 批次：多選（Ctrl / Shift）→ 批次加減標籤 → 確認後套用。
- [ ] 篩選對話框：套條件、再按重置 → 條件全清但 `currentId` 保留。
- [ ] 錯誤路徑：
  - [ ] **樂觀併發衝突**：開兩個 editor 分頁選同一張圖，A 存檔成功後，B 不重新整理直接存檔 →
        toast「存檔失敗: 紀錄已被其他操作更新，請重新整理後再試」（HTTP 409 `stale_update`，
        error 內帶 `expectedUpdatedAt` / `actualUpdatedAt`）。
  - [ ] 批次把某張圖的標籤全移除 → 前端先擋（「由於會沒有標籤，已跳過 N 張圖片」）。
  - [ ] devtools：`PATCH /api/committed/<不存在的檔名>` 帶合法 body → 404 `not_found`。
  - [ ] devtools：`PATCH /api/committed/<檔名>` 不帶 `expectedUpdatedAt` → 400 字串「無效的預期更新時間」。
  - [ ] 取消提交（刪除鍵）→ 圖片回到 staged；再對同一檔名 `DELETE /api/committed/<檔名>` → 404 `not_found`。

## 6. tags 管理（改名 / 刪除 / hidden）

- [ ] 改名：把常用標籤 A 改名 B → 所有圖的 A 變 B；再把 B 改回 A。
  - [ ] 改名為圖片已有的另一標籤（合併場景）→ 成功、無重複標籤。
  - [ ] devtools：`POST /api/tags` body `{ "oldName": "x", "newName": "a,b" }` → 400 `validation`
        （標籤名含逗號不合法，`fields: ["newName"]`）。
  - [ ] devtools：oldName = newName → 200 `{ affected: 0 }`（新行為：no-op 而非 400）。
- [ ] 刪除：
  - [ ] 刪一個「所有持有圖片都還有其他標籤」的標籤 → 成功，`affected` = 圖片數。
  - [ ] **last_tag**：刪某張圖的唯一標籤 → 409 `last_tag`，`images` 列出受影響 id；
        前端顯示「有圖片會因此失去最後一個標籤」。
- [ ] hidden（settings 頁）：
  - [ ] 把標籤 H 設為隱藏 → home 空查詢看不到帶 H 的圖；facet 中 H 的計數 =「解鎖後會有幾張」。
  - [ ] 查詢明確 include H → 圖片現身。
  - [ ] settings 的 authoring 清單（不遮蔽、含未使用標籤）仍列出 H。
  - [ ] 取消隱藏 → 圖片全部回來。

## 7. compare

- [ ] 開 `/compare` → 每次重新整理隨機兩張；投票/瀏覽功能正常。
- [ ] 帶篩選參數進 compare（如 `?includedTags=A`）→ 兩張都符合條件。
- [ ] hidden 標籤的圖不會出現在隨機對中（除非 include 解鎖）。

## 8. player

- [ ] 從有結果的篩選開 `/player` → 正常輪播。
- [ ] 手改 URL 成零結果的條件 → 302 導回 `/`（帶原查詢參數）。

## 9. settings 維護掃描

- [ ] metadata：`GET /api/settings/metadata` 檢查缺元資料數量 → 補算 → 數量歸 0。
- [ ] missing：手動從 `images/` 刪掉一張已提交圖的檔案 → 掃描列出該 id → 執行清除 →
      紀錄移除、committed 數 -1。
- [ ] backup：執行備份 → 下載到 zip，內含 `images/` 與 `db.json`。
- [ ] 側欄計數在以上操作後始終與實際 committed/staged 相符。

## 10. 未載入守衛（503）

- [ ] 把 collection path 指到無效位置（或重啟 dev server 後不進任何頁面直接打 API）：
      `PATCH /api/tags` → 503 字串「尚未載入資料庫」；頁面路由則導向 `/settings?alert=...`。

## 11. 持久化收尾

- [ ] 做完任一寫入後等 ≥ 500ms，確認 `db.json` 內容更新（防抖寫入）。
- [ ] `Ctrl+C` 關掉 dev server → log 出現「接收到 SIGINT 訊號，正在寫入資料庫…」且 `db.json` 為最新。
- [ ] 重啟 server → 資料原樣載回（v2 格式，`tags` 稀疏儲存：無自訂 meta 的標籤不出現在檔案裡）。
