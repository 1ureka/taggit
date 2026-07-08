# 7. 顯示當前 collection 的名稱

> 找地方顯示當前 collection 的名稱（右上?）。

## 目標

- 在全域 header 右側常駐顯示目前作用中的 collection 名稱（basename），讓使用者一眼確認正在操作哪個圖片集。
- 在導航 dialog（[+layout.svelte:131-140](../src/routes/+layout.svelte#L131-L140)）正上方的路徑欄（`<span>{page.url.pathname + page.url.search}</span>`，[+layout.svelte:136](../src/routes/+layout.svelte#L136)）前方，同樣加上該 basename，讓「目前在哪個 collection、哪個路徑」在同一處一起顯示。

## 方案：SSR，只傳 basename，永不傳完整路徑

單一方案，不設替代路徑（不做 `GET /api/collection` 這種前端另行 fetch 的版本）：

- **只在 layout server 算一次、只送 basename**：[+layout.server.ts](../src/routes/+layout.server.ts) 用 `getActiveRoot() ?? getCollectionRoot()` 取得 root，`root ? path.basename(path.normalize(root)) : ""` 算出 `collectionName`，作為 page data 的一部分回傳。**絕對路徑本身不進前端 payload**——basename 已足夠辨識，完整路徑對使用者沒有額外資訊、對隱私/乾淨的 payload 也沒好處。
- **`/settings` 分支也要回傳**：目前 layout server 對 `/settings` 提前 `return;`（未回傳任何 data）。改為：無論哪個分支，都先算出 `collectionName` 再回傳；重導 / 驗證邏輯不變。未設定 collection 時 `collectionName` 為空字串，前端據此不顯示或顯示佔位。
- **為何是 SSR 而非前端另開端點**：
  - `getActiveRoot()` 是純記憶體讀取，`path.basename` 成本可忽略——SSR 這條路徑幾乎零額外開銷，且每個頁面本來就會跑 layout server。
  - 若改走前端 `GET /api/collection`，會多一次 round trip、多一份載入狀態（loading/error）要處理，且首次渲染會有「先空白、fetch 完才出現名稱」的閃爍；SSR 版本則是**跟頁面內容一起吐出**，沒有這個問題。
  - 額外的網路請求也代表一個可被觀察/攔截的端點回傳「目前作用中的 collection 名稱」，SSR 內嵌在既有 page data 沒有這個額外暴露面。
  - 唯一的取捨：SSR 版本會讓 `collectionName` 隨每次導航重新計算一次（但如前述，成本可忽略，不構成理由改用前端 fetch）。
- `+layout.svelte` 以 `let { data, children } = $props()` 取用 `data.collectionName`（目前只解構 `children`，需補上 `data`）。

## 實作步驟

### 1. layout server 回傳 collectionName

[+layout.server.ts](../src/routes/+layout.server.ts)：移除 `/settings` 的提前 `return;`，改成兩個分支都算出 `collectionName` 並回傳 `{ collectionName }`（`/settings` 分支保留原本的驗證/重導邏輯，只是額外帶上這個欄位）。

### 2. header 右側顯示

[+layout.svelte](../src/routes/+layout.svelte) 的 `<header>`（grid `1fr minmax(180px,240px) 1fr`，右側第三欄目前空）：

- 加一個顯示區塊（如 `IconDatabase` + `data.collectionName`），`title` 放完整用意明確的文字（例如「當前圖片集：{name}」，不外洩完整路徑，因為 payload 本來就沒有），`.ellipsis` 截斷過長名稱。
- `collectionName` 為空字串時不顯示（未設定 collection 通常已被重導 settings）。
- 樣式：`justify-self: end`，沿用 `--text-muted` / caption 級字體，與中間狀態列按鈕風格協調。

### 3. 導航 dialog 路徑欄前方加 basename

[+layout.svelte:136](../src/routes/+layout.svelte#L136)：

```svelte
<span class="ellipsis">{page.url.pathname + page.url.search}</span>
```

改為在同一個 `<span>`（或前面新增一個小 chip）內，先顯示 `data.collectionName`，再接原本的路徑，例如 `{data.collectionName} · {page.url.pathname + page.url.search}`；`collectionName` 為空字串時不顯示分隔符與名稱，退回原本純路徑顯示。沿用 `.ellipsis`，避免路徑被名稱擠到看不到。

### 4. fullscreen（player）維持現況

header 在 player 全螢幕時隱藏（`{#if !fullscreen}`），本項目不改變這個行為；導航 dialog 本身在任何頁面都可能被打開，第 3 點的改動不受 fullscreen 影響。

## 風險 / 注意

- layout server 目前**刻意**對 `/settings` 提前 return 以省 I/O；本次改動只是在該分支也回傳 `collectionName`，`getActiveRoot()` 為純記憶體讀取，不新增 I/O，維持「記憶體優先、避免每請求額外磁碟 I/O」的精神。
- 只送 basename、不送完整路徑，兩處顯示（header、導航 dialog）都必須遵守，不要在任何一處把完整路徑塞進 `title` 或其他屬性。

## 驗收

- 各頁（首頁 / tagger / editor / settings）header 右側顯示當前 collection 名稱（basename）。
- 導航 dialog 打開時，正上方路徑欄前方顯示同一個 basename，緊接著原本的路徑。
- 切換 collection（項目 3/4 之後）→ 兩處名稱皆即時更新（`invalidateAll` 或導頁後）。
- player 全螢幕不顯示 header（維持現況）；導航 dialog 的路徑欄改動不受影響。
- 檢查前端收到的 layout data 與任何 network payload，確認沒有完整絕對路徑外洩，只有 basename。
