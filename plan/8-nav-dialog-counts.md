# 8. 導航 dialog 顯示 committed / staged 數量

> 導航 dialog 的「管理圖片」與「新增圖片」連結按鈕右側（justify-end）會分別顯示 committed 與 staged 的數量。

## 目標

在全域導航 dialog（命令選單）中，於兩個導航項右側各顯示一個數字徽章：

- **「管理圖片」（`/editor`）** → **committed** 數量（已提交至 db.json 的圖片數）。
- **「新增圖片」（`/tagger`）** → **staged** 數量（`images/` 存在但 db 尚無紀錄的暫存圖片數）。

## 現況

- 導航 dialog 在 [+layout.svelte](../src/routes/+layout.svelte) 的 `<Modal>` 內，`navItems` 陣列（含 `/`, `/tagger`, `/editor`, `/settings`）以 `{#each}` 渲染成 `<a>`，版面為 grid（icon / 標題 / 說明）。目前無數量顯示。
- 數量來源（皆 server 端）：
  - committed：`database.getImageCount()`（[database/server.ts](../src/lib/database/server.ts)）。
  - staged：`listImageFiles(paths.images).filter(f => !database.hasImage(f))` 的長度——tagger load 已這樣算（[tagger/+page.server.ts](../src/routes/tagger/+page.server.ts)）。
- layout 目前未回傳 data（見項目 7）。

## 實作步驟

本項目與 **項目 7** 都需要 layout 對外提供 data，建議合併處理。

### 1. 提供數量給 layout

兩個選擇：

- **方案 A（建議）：layout server 回傳計數**
  [+layout.server.ts](../src/routes/+layout.server.ts) 在資料庫已載入時計算並回傳 `{ committedCount, stagedCount }`：
  - `committedCount = database.getImageCount()`（純記憶體，便宜）。
  - `stagedCount`：需 `listImageFiles(paths.images)` 掃目錄再 filter `!hasImage` —— 這是 **magic：每次導航都會做一次目錄 I/O**。若圖片多可能有成本。
  - 導航 dialog 的數字**只在打開選單時才需要**，放 layout server 會讓每次頁面請求都算 staged。故評估：committed 幾乎免費、可放 layout；staged 有 I/O。
- **方案 B：懶載入端點，開選單才抓**
  新增 `GET /api/counts`（回 `{ committed, staged }`），layout 的 `handleTogglePalette` 開啟選單時 `api.get` 一次並存入本地 state。避免每次導航的 I/O，數字為「開選單當下」的即時值。

**建議**：committed 走方案 A（放 layout data，順帶支援項目 7）；staged 走方案 B（開選單才抓）或同樣放 `GET /api/counts` 一起抓。若想簡單一致，直接**都用 `GET /api/counts`，開選單時抓一次**最省事且語意清楚。

> 現有 `POST /api/committed` 是匯入用途；建議另開 `GET /api/counts` 而非在該檔加 GET，語意更清楚。端點需 `collection.getActiveRoot()` + `database.isLoaded()` 檢查，未就緒回 0 或 503。

### 2. 導航項渲染徽章

[+layout.svelte](../src/routes/+layout.svelte)：

- `navItems` 增加可選欄位 `key?: "committed" | "staged"`，`/editor` 標 `committed`、`/tagger` 標 `staged`。
- `{#each navItems}` 的 `<a>` grid 增加一欄放徽章（`justify-self: end` / 右側），依 `key` 取對應數字；無 `key`（如 `/`、`/settings`）不顯示。
- 數字來源綁到步驟 1 的 state / page data；未載入時顯示占位或不顯示。
- 樣式沿用既有 `.badge`（tagger 已有）或 chip 風格，靠右對齊。

## 需要決策

- **staged 計數的取得時機 / 成本**（建議：開選單才抓，`GET /api/counts`）——避免每次導航的目錄掃描。
- **committed 定義**：draft 的「committed」＝ db.json 內全部紀錄數（`getImageCount`，不受 hidden 遮蔽影響）。確認採原始總數而非遮蔽後的可見數。（建議：原始總數，代表「管理圖片」可管理的全部。）
- **即時性**：提交 / 刪除後數字是否需即時更新。若走 `invalidateAll`＋layout data 會自動更新；若走開選單才抓的端點，則每次開選單都是最新，通常足夠。

## 風險 / 注意

- 別讓 staged 的目錄 I/O 落在每次頁面導航的關鍵路徑上。
- 未設定 / 未載入 collection 時（會被重導 settings），端點應安全回 0。

## 驗收

- 打開導航 dialog：「管理圖片」右側顯示 committed 數、「新增圖片」右側顯示 staged 數，數字與 editor / tagger 頁實際一致。
- 提交一張暫存圖後重新打開選單：staged −1、committed +1。
- 未設定 collection 時不報錯（數字為 0 或不顯示）。
