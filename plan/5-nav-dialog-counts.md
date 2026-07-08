# 8. 導航 dialog 顯示 committed / staged 數量

> 導航 dialog 的「管理圖片」與「新增圖片」連結按鈕右側會分別顯示 committed 與 staged 的數量。

## 目標

在全域導航 dialog（命令選單）中，於兩個導航項右側各顯示一個數字徽章：

- **「管理圖片」（`/editor`）** → **committed** 數量（`db.json` 內全部紀錄數，原始總數，不受 hidden 標籤遮蔽影響）。
- **「新增圖片」（`/tagger`）** → **staged** 數量（`images/` 存在但 db 尚無紀錄的暫存圖片數）。

## 現況

- 導航 dialog 在 [+layout.svelte](../src/routes/+layout.svelte) 的 `<Modal>` 內，`navItems` 陣列以 `{#each}` 渲染成 grid 版面的 `<a>`（icon / 標題 / 說明），目前無數量欄位。
- [+layout.server.ts](../src/routes/+layout.server.ts) 已回傳 `{ collectionName }` 並被 `+layout.svelte` 使用（[+layout.svelte:139](../src/routes/+layout.svelte#L139)）。它的 load 讀取了 `url.pathname`，因此**每次導航都會重新執行**。
- 數量算法：
  - committed：`database.getImageCount()`（[database/server.ts](../src/lib/database/server.ts) → 純記憶體 `Object.keys(db.data.images).length`，幾乎免費）。
  - staged：`listImageFiles(paths.images).filter(f => !database.hasImage(f))`，tagger load 已這樣算（[tagger/+page.server.ts](../src/routes/tagger/+page.server.ts)）。`listImageFiles`（[image/server.ts:40](../src/lib/image/server.ts#L40)）內部只是 `fs.readdirSync` + 副檔名過濾 + 排序，**沒有對個別檔案做 `stat`**，是單次、便宜的目錄列表操作。
- `.badge` 樣式已存在於全域樣式（[app-basic.css:101](../src/lib/styles/app-basic.css#L101)），tagger 頁已用同樣式顯示數量（[tagger/+page.svelte:102](../src/routes/tagger/+page.svelte#L102)），可直接沿用。

## 專案哲學與此功能的關係

[README.md](../README.md) 明確定位本專案「僅作為殼」：資料一律留在本地檔案系統，**使用者可隨時在 `images/` 資料夾手動增刪檔案**，甚至這是 staged 流程官方列出的第一種做法（「直接把檔案丟進收藏目錄的 `images/` 資料夾」），不經過任何 API。

這代表：

- **不能快取目錄列表**。任何只在 API 呼叫（上傳／刪除暫存）時失效的快取，都會漏掉「使用者手動丟檔案進資料夾」這個主要工作流程，導致數字與磁碟實際狀態脫節，直到剛好又觸發一次 API 呼叫才被動修正——這比「多一次 readdir」的成本更糟。
- 目錄列表既然只是單次 `readdirSync`（無 per-file stat），成本可接受，直接每次現算即可，不需要任何快取層。

## 新鮮度：直接沿用既有 `invalidateAll` 機制

確認過所有會改變 committed/staged 狀態的操作都已呼叫 `invalidateAll()`：

- tagger 提交（[taggerForm.svelte.ts:86](../src/routes/tagger/taggerForm.svelte.ts#L86)）、刪除暫存（[taggerForm.svelte.ts:112](../src/routes/tagger/taggerForm.svelte.ts#L112)）
- tagger 上傳（[taggerList.svelte.ts:153](../src/routes/tagger/taggerList.svelte.ts#L153)）、匯入（[taggerList.svelte.ts:245](../src/routes/tagger/taggerList.svelte.ts#L245)）、手動「重新整理」（[taggerList.svelte.ts:125](../src/routes/tagger/taggerList.svelte.ts#L125)——這顆按鈕本來就是給使用者手動丟檔案進 `images/` 後強制重新整理用的）
- editor 存檔單張／批次（[editorFormActions.svelte.ts:107](../src/routes/editor/editorFormActions.svelte.ts#L107) / [148](../src/routes/editor/editorFormActions.svelte.ts#L148)）、退回暫存區（[editorFormActions.svelte.ts:173](../src/routes/editor/editorFormActions.svelte.ts#L173)）

`invalidateAll()` 會強制重跑所有作用中的 load，含 `+layout.server.ts`；而它本來就因為讀了 `url.pathname` 每次導航都會重跑。因此把 committed/staged 數量放進 layout 的 SSR data，其新鮮度機制與現有 `ImageWithId[]` / `Tag[]` 等 SSR 資料完全一致，不需要任何額外處理。

## 實作步驟

### 1. layout server 計算並回傳兩個數量

[+layout.server.ts](../src/routes/+layout.server.ts) 在 collection 與 db 都就緒的分支內，直接現算：

```ts
const paths = collection.getCollectionPaths(root);
const committedCount = database.getImageCount();
const stagedCount = image.listImageFiles(paths.images).filter((f) => !database.hasImage(f)).length;

return { collectionName, committedCount, stagedCount };
```

- `/settings` 分支（尚未有 active root）與尚未設定 collection 時，維持只回傳 `{ collectionName }`（不含 counts），前端據此判斷「沒有資料就不顯示」。
- 不新增任何快取或 `GET /api/counts` 端點；不需要在 `POST /api/staged`、`DELETE /api/staged/[filename]` 等處額外呼叫失效邏輯。

### 2. 導航項渲染徽章

[+layout.svelte](../src/routes/+layout.svelte)：

- `navItems` 增加可選欄位 `key?: "committed" | "staged"`，`/editor` 標 `committed`、`/tagger` 標 `staged`。
- `{#each navItems}` 的 `<a>` grid 增加第三欄放徽章：`grid-template-columns` 由 `auto 1fr` 改為 `auto 1fr auto`，badge 放在第一列（與 `<h2>` 同列），`justify-self: end`。
- 數字來源：`key === "committed" ? data.committedCount : key === "staged" ? data.stagedCount : undefined`；`undefined` 時不渲染 `.badge`（對應 `/`、`/settings` 兩個無 key 的項目，以及 counts 尚未就緒的情況——例如尚未設定 collection）。
- 樣式沿用既有 `.badge`（[app-basic.css:101](../src/lib/styles/app-basic.css#L101)），不需新增 CSS class，只需版面上多一欄。

## 風險 / 注意

- 每次導航都會多算一次 `committedCount`（純記憶體，可忽略）與一次 `listImageFiles`（單次 `readdirSync`，可忽略）。若日後圖片庫大到這個成本變得可觀，屆時再評估是否需要優化；現階段不預先為此設計快取。
- 未設定 / 未載入 collection 時（會被重導 `/settings`），`committedCount` / `stagedCount` 不存在於 data，前端需正確處理「無 key 時不顯示」而不是顯示 0（0 是「有資料但空」，undefined 是「還沒有資料」，語意不同）。

## 驗收

- 打開導航 dialog：「管理圖片」右側顯示 committed 數、「新增圖片」右側顯示 staged 數，數字與 editor / tagger 頁實際一致。
- 提交一張暫存圖後（觸發 `invalidateAll`）重新打開選單：staged −1、committed +1。
- 上傳新的暫存圖片、或手動把檔案丟進收藏目錄的 `images/` 資料夾後按「重新整理」：staged 數立即反映最新的磁碟狀態。
- 退回一張已提交圖片至暫存區後：committed −1、staged +1。
- 未設定 collection 時（`/settings`）導航 dialog 不報錯，兩個徽章不顯示。
