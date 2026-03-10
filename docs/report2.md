# 表單路由 URL Query Params 遷移分析報告

> 分析各路由的表單/篩選狀態是否適合改為 URL query params 驅動，以提升可書籤化、瀏覽器歷史導航、重新整理後狀態保留等使用者體驗。

---

## 一、現況總覽

| 路由 | 表單狀態 | 目前儲存方式 | 是否使用 URL params |
|------|---------|-------------|-------------------|
| `/browse` | tags, rating, sort | `$state`（無頭 UI） | ❌（但提交時組裝 params 傳給 player） |
| `/browse/player` | tags, rating, sort, order | URL query params | ✅ 已使用 |
| `/editor` | searchText, tags, rating, sort, order, page | Context `$state` | ❌ |
| `/scroll` | selectedTags, rating, ratingOp, sort, order, columns | Context `$state` | ❌ |
| `/compare` | filterTags, filterMinRating | `$state`（無頭 UI） | ❌ |
| `/trash` | searchText, page | Context `$state` | ❌ |
| `/tagger` | cursor, tags, rating, selected | Context `$state` | ❌ |
| `/settings` | alert（重定向用） | `window.location.search` | ⚠️ 僅 alert 參數 |
| `/editor/[id]` | （無篩選狀態） | route param | ✅ 已使用 |

---

## 二、逐路由分析

### 2.1 `/browse`（瀏覽設定表單）

**表單參數**：`tags`、`rating`、`sort`

**現況**：使用者填寫篩選條件後點擊「開始瀏覽」，`browseForm.svelte.ts` 透過 `goto()` 將參數組裝為 URL query params 傳遞至 `/browse/player`。表單本身的 `tags`、`rating`、`sort` 狀態存在 `$state` 中。

**建議**：❌ **不建議改為 URL params**

- 這是一個**一次性設定頁面**，使用者填完即離開，不會長時間停留或需要回到特定篩選狀態。
- 真正需要保存的查詢狀態已經在 `/browse/player` 的 URL params 中了。
- 將此表單 URL 化會增加實作複雜度，但幾乎沒有使用場景上的收益。

---

### 2.2 `/browse/player`（水平輪播）

**表單參數**：`tags`、`rating`、`sort`、`order`

**現況**：✅ **已經是 URL query params 驅動**。`+page.server.ts` 使用 `parseQueryParams(url)` 解析篩選條件，在 SSR 階段查詢資料庫。

**建議**：✅ 維持現狀，這是正確的做法。

---

### 2.3 `/editor`（圖片編輯器列表）⭐

**表單參數**：`searchText`、`tags`、`rating`、`sort`、`order`、`page`

**現況**：所有篩選與分頁狀態存儲在 `EditorContext`（`$state`）。搜尋文字 300ms debounce 後觸發 client-side API 呼叫 (`/api/images`)，篩選條件變更時立即觸發查詢。分頁透過 `EditorPagination` 操作 `ctx.page`。

**建議**：⭐ **強烈建議改為 URL params**

**理由**：
1. **這是典型的搜尋/瀏覽頁面**——使用者在篩選條件中來回切換、翻頁、搜尋，操作模式完全符合 URL params 的語義。
2. **瀏覽器歷史導航**：使用者點進 `/editor/[id]` 編輯後按返回鍵，目前會**遺失所有篩選條件**，回到預設狀態。若篩選存在 URL 中，返回時可自動恢復。
3. **重新整理**：F5 後篩選條件全部歸零，使用者需重新設定。
4. **分頁**：`page` 參數放進 URL 是最自然的做法，也能讓「第 3 頁搜尋 tag:cat」這種狀態可分享。
5. **SSR 預查**：目前 `+page.server.ts` 只做無條件的前 60 筆查詢。若篩選條件在 URL 中，SSR 可直接依據 params 查詢，消除頁面載入後的第一次 client API 呼叫，提升首屏體驗。

**預計改動範圍**：
- `+page.server.ts`：讀取 `url.searchParams`，以篩選條件查詢資料庫
- `context.svelte.ts`：`searchText`、`tags`、`rating`、`sort`、`order`、`page` 初始值從 SSR data 取得
- `editorForm.svelte.ts`：篩選變更時使用 `goto('?search=...&tags=...', { replaceState: true })` 更新 URL（而非僅 API 呼叫）
- `editorPagination.svelte.ts`：翻頁時更新 URL params
- 需注意 debounce 與 `replaceState` 的配合——搜尋文字輸入中應 `replaceState`，避免每次按鍵都產生歷史記錄

**URL 格式範例**：
```
/editor?search=cat&tags=animal,cute&rating=3&sort=rating&order=desc&page=2
```

---

### 2.4 `/scroll`（瀑布流捲動瀏覽）⭐

**表單參數**：`selectedTags`、`rating`、`ratingOp`、`sort`、`order`、`columns`

**現況**：所有篩選狀態存在 `ScrollContext`（`$state`）。SSR 預查所有圖片（無篩選），篩選條件變更後 client-side 呼叫 `/api/images`。

**建議**：⭐ **強烈建議改為 URL params**

**理由**（與 `/editor` 類似）：
1. **搜尋/瀏覽頁面**：使用者調整篩選條件瀏覽不同子集，這是 URL params 的最佳使用場景。
2. **重新整理後狀態保留**：目前 F5 後篩選歸零、回到全量載入。
3. **SSR 優化**：目前 SSR 載入**全部圖片**（`queryImages(db, { sort: "committedAt", order: "desc" })`），將篩選條件帶入 URL 後，SSR 可只查詢符合條件的圖片，大幅減少初始資料量。
4. **書籤化**：「只看 5 星 + tag:landscape」這種常用篩選可以被書籤收藏。

**額外考量**：
- `columns` 偏向 **UI 偏好**而非資料篩選，可考慮不放入 URL（或作為可選 param）。
- `ratingOp` 是此路由獨有的（`gte`/`lte`/`eq`），需確保 URL 格式與其他路由一致。

**URL 格式範例**：
```
/scroll?tags=landscape,nature&rating=4&ratingOp=gte&sort=committedAt&order=desc
```

---

### 2.5 `/compare`（隨機比較）

**表單參數**：`filterTags`、`filterMinRating`

**現況**：篩選狀態存在 `compareView.svelte.ts` 的 `$state` 中。每次 shuffle 或篩選變更都呼叫 `/api/images?sort=random&limit=2&...`。

**建議**：🔶 **可選改進，但優先級低**

**理由**：
- **有利面**：若使用者常用特定篩選條件比較（如「只比較 3 星以上的 landscape」），URL params 可讓這個組合被書籤化。
- **不利面**：因為是隨機抽取，書籤化的 URL 每次開啟結果都不同——URL params 只保留了篩選意圖而非具體結果。使用場景偏弱。
- **改動成本低**：只有 `filterTags` 和 `filterMinRating` 兩個參數，改動範圍小。

**結論**：若順便做，成本不高；但若排優先級，應排在 `/editor` 和 `/scroll` 之後。

---

### 2.6 `/trash`（垃圾桶）

**表單參數**：`searchText`、`page`

**現況**：搜尋文字和分頁存在 `TrashContext`（`$state`）。Debounce 後 client-side API 呼叫。

**建議**：🔶 **可選改進，優先級中等**

**理由**：
- **分頁 URL 化**是普遍的 UX 慣例，使用者在垃圾桶中翻頁後按返回鍵，預期回到上一頁而非回到首頁。
- 搜尋文字 URL 化的收益相對有限（垃圾桶通常不會有太多需要精確搜尋的場景）。
- 結構與 `/editor` 幾乎相同（搜尋 + 分頁），可以在改造 `/editor` 後低成本複製模式。

**URL 格式範例**：
```
/trash?search=photo&page=2
```

---

### 2.7 `/tagger`（標籤審查工具）

**表單參數**：`cursor`、`tags`、`rating`、`selected`

**現況**：所有狀態存在 `TaggerContext`。這是一個**工作流工具**——使用者逐張審查待處理圖片，設定標籤與評等後提交。

**建議**：❌ **不建議改為 URL params**

**理由**：
- 這不是搜尋/瀏覽頁面，而是**線性工作流**。`tags` 和 `rating` 是正在編輯中的表單值（將被提交到 API），不是篩選條件。
- `cursor` 和 `selected` 是暫態的操作狀態，URL 化毫無意義。
- 使用者不會書籤「正在審查第 5 張圖片」這種中間狀態。

---

### 2.8 `/settings`（系統設定）

**表單參數**：`alert`（僅重定向用途）

**現況**：`+page.svelte` 用 `window.location.search` 讀取 `alert` 參數，顯示對應的提示訊息。各設定子表單（路徑設定、標籤重命名、維護工具）的狀態都存在各自的 `$state` 中。

**建議**：❌ **不建議改為 URL params**

**理由**：
- 設定頁面的表單是**操作型**（輸入路徑 → 儲存、輸入新標籤名 → 重命名），不是篩選/搜索型。
- 目前 `alert` 參數的用法已經合理（一次性的重定向提示）。

---

## 三、優先級排序

| 優先級 | 路由 | 收益 | 改動成本 | 說明 |
|--------|------|------|---------|------|
| ⭐ P0 | `/editor` | 高 | 中 | 搜尋 + 篩選 + 分頁，最典型的 URL params 場景；SSR 可同步優化 |
| ⭐ P0 | `/scroll` | 高 | 中 | 篩選 + 排序 + 瀏覽，同上；SSR 目前載入全量資料，優化空間大 |
| 🔶 P1 | `/trash` | 中 | 低 | 搜尋 + 分頁，結構簡單，改造後可複用 `/editor` 的模式 |
| 🔶 P2 | `/compare` | 低 | 低 | 只有兩個篩選參數，但隨機性質降低了 URL 化的實際收益 |
| ❌ — | `/browse` | 無 | — | 一次性設定頁，最終結果已在 `/browse/player` URL 中 |
| ❌ — | `/tagger` | 無 | — | 工作流工具，非搜尋/瀏覽場景 |
| ❌ — | `/settings` | 無 | — | 操作型設定表單，非篩選場景 |

---

## 四、實作策略建議

### 4.1 通用模式

將篩選狀態遷移至 URL params 時，建議採用統一的模式：

```
+page.server.ts   讀取 url.searchParams → 查詢 DB → 回傳結果
+page.svelte      接收 data → 注入 Context（初始值來自 SSR data）
*Form.svelte.ts   篩選變更 → goto(`?${params}`, { replaceState }) 更新 URL
                   ↳ SvelteKit 自動重新執行 load → data 更新 → UI 更新
```

這與目前的 `client API 呼叫 → 手動更新 Context` 模式相比，有以下優勢：
- **消除重複的 API 呼叫邏輯**：目前 `editorForm`、`editorPagination`、`editorSelectionDock` 各自複製了 `doSearch()`；改為 URL 驅動後，只需一個 `+page.server.ts` 的 `load` 函式。
- **SSR 與 CSR 資料流統一**：首次載入和後續篩選走同一條資料路徑。
- **自動獲得瀏覽器歷史支援**：無需手動管理。

### 4.2 Debounce 搜尋的處理

對於需要 debounce 的搜尋文字輸入：

```ts
// editorForm.svelte.ts
function handleSearchInput() {
  if (ctx.searchTimer) clearTimeout(ctx.searchTimer);
  ctx.searchTimer = setTimeout(() => {
    const params = buildParams(); // 組裝所有篩選條件
    goto(`?${params}`, { replaceState: true, noScroll: true });
  }, ctx.SEARCH_DEBOUNCE);
}
```

- `replaceState: true`：搜尋輸入中不新增歷史記錄
- `noScroll: true`：避免 SvelteKit 導航時捲動到頂部

### 4.3 分頁的處理

分頁切換應使用 `pushState`（而非 `replaceState`），讓「上一頁」等同於瀏覽器返回：

```ts
function handlePageClick(p: number) {
  const params = buildParams();
  params.set("page", String(p));
  goto(`?${params}`, { noScroll: true }); // pushState（預設）
}
```

### 4.4 與現有 Context 系統的整合

不需要廢棄 Context 系統。Context 仍然負責跨元件的響應式狀態共享，改變的只是**初始值來源**和**更新觸發方式**：

| 面向 | 目前 | 改造後 |
|------|------|--------|
| 初始值 | 硬編碼預設值 | 從 SSR `data`（= URL params 解析結果）取得 |
| 更新觸發 | 篩選變更 → API 呼叫 → 手動寫入 Context | 篩選變更 → `goto()` → SvelteKit re-load → data 更新 → Context 更新 |
| 跨元件共享 | Context `$state` | 不變 |
| Timer / 選取狀態 | Context | 不變（這些是 pure UI 狀態，不進 URL） |

### 4.5 哪些狀態不應進入 URL

並非所有 Context 中的 `$state` 都該 URL 化。只有**代表使用者查詢意圖的篩選條件**才適合：

| ✅ 適合 URL 化 | ❌ 不適合 URL 化 |
|---------------|----------------|
| `searchText`、`tags`、`rating` | `loading`、`showLoading` |
| `sort`、`order`、`ratingOp` | `selected`（選取的 ID 集合） |
| `page` | Timer 引用 |
| | DOM 元素引用 |
| | `columns`（UI 偏好，可選） |

---

## 五、風險與注意事項

1. **SvelteKit 導航行為**：`goto()` 預設會重新執行 `load` 函式，若篩選條件變更頻繁（如 debounce 搜尋），需確認伺服器查詢效能不會成為瓶頸。此專案使用 `better-sqlite3`（同步 I/O），查詢成本極低，風險不大。

2. **URL 長度限制**：`tags` 以逗號分隔放在 URL 中，若標籤數量極多（> 30 個），URL 可能過長。可設定合理上限或改用其他編碼方式。

3. **預設值省略**：當篩選條件為預設值時，不應出現在 URL 中（例如 `page=1` 就省略），保持 URL 簡潔。

4. **`/editor` 中多處 `doSearch()` 的合併**：目前 `editorForm`、`editorPagination`、`editorSelectionDock` 各自有一份 `doSearch()`，遷移後這些都可以收斂為一個 `goto()` + `load` 的流程，大幅簡化程式碼。
