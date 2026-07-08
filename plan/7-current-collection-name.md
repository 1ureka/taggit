# 7. 顯示當前 collection 的名稱

> 找地方顯示當前 collection 的名稱（右上?）。

## 目標

在全域 header 常駐顯示目前作用中的 collection 名稱，讓使用者一眼確認正在操作哪個圖片集。位置：header 右側（draft 建議右上）。

## 現況

- 全域 header 在 [+layout.svelte](../src/routes/+layout.svelte)：grid `1fr minmax(180px,240px) 1fr`——左為 `<h1>Taggit`，中為狀態列按鈕，**右側第三欄目前是空的**，正好放 collection 名稱。
- collection 名稱來源：`collection.getCollectionRoot()` / `getActiveRoot()`（[collection/server.ts](../src/lib/collection/server.ts)）是絕對路徑；「名稱」取其 basename 即可。
- **layout 目前未把 root 傳給前端**：[+layout.server.ts](../src/routes/+layout.server.ts) 沒有 `return` 任何 data（且對 `/settings` 提前 return）。需要補上。

## 實作步驟

### 1. layout server 回傳 collection 名稱

[+layout.server.ts](../src/routes/+layout.server.ts)：

- 目前 `/settings` 會提前 `return;`——但 settings 頁也想顯示 header 名稱。調整為：**先算出可對外的 collectionRoot 再回傳**，重導與驗證邏輯維持。
- 具體：計算 `root`（沿用 `getActiveRoot() ?? getCollectionRoot()`）；即使是 `/settings` 分支也回傳 `{ collectionName }`（settings 未設定時可能為空字串）。
- 回傳 `collectionName = root ? path.basename(root) : ""`（在 server 端算，避免把絕對路徑外洩到前端）。
  - 注意 Windows 路徑：`path.basename` 已能處理；若 root 以分隔符結尾，先 `path.normalize`。
- `+layout.svelte` 以 `let { data, children } = $props()` 取用（目前只解構 `children`，需加 `data`）。

> 若不想改動 layout server 的既有 early-return 結構，替代做法：新增輕量 `GET /api/collection`（回 `{ name }`），layout 於前端載入時 `api.get` 一次。但 layout server data 是更直接、SSR 友善的選擇（建議）。

### 2. header 右側顯示

[+layout.svelte](../src/routes/+layout.svelte) `{#if !fullscreen}` 的 `<header>`：

- 在第三欄放一個顯示區塊（如帶 `IconDatabase` + 名稱文字），`title` 用完整名稱、`.ellipsis` 截斷。
- 空名稱（未設定 collection，通常會被重導到 settings）時可不顯示或顯示占位。
- 樣式：靠右對齊（`justify-self: end`），沿用 `--text-muted` / caption 級字體，與中間狀態列風格協調。

## 需要決策

- **顯示 basename 還是完整路徑**（建議 basename + `title` 顯示完整路徑）。draft 說「名稱」，basename 較短適合常駐；hover 出完整路徑補足資訊。
- **fullscreen（player）是否顯示**：現況 header 在 player 隱藏，維持即可。

## 風險 / 注意

- layout server 目前**刻意**對 `/settings` 提前 return 以省 I/O；改動時保留「記憶體優先、避免每請求 I/O」的精神——`getActiveRoot()` 為純記憶體讀取，計算 basename 成本可忽略。
- 別把絕對路徑送到前端 payload（隱私 / 乾淨）；只送 basename。

## 驗收

- 各頁（首頁 / tagger / editor / settings）header 右側顯示當前 collection 名稱。
- 切換 collection（項目 3/4 之後）→ 名稱即時更新（`invalidateAll` 或導頁後）。
- player 全螢幕不顯示 header（維持現況）。
