# 表單路由 URL Query Params 遷移分析報告

> 分析各路由的表單/篩選狀態是否適合改為 URL query params 驅動，以提升可書籤化、瀏覽器歷史導航、重新整理後狀態保留等使用者體驗。

---

## 一、現況總覽

| 路由             | 目前儲存方式             | 是否使用 URL params |
| ---------------- | ------------------------ | ------------------- |
| `/browse`        | `$state`（無頭 UI）      | ❌                  |
| `/browse/player` | URL query params         | ✅ 已使用           |
| `/editor`        | URL query params         | ✅ 已完成遷移       |
| `/scroll`        | URL query params         | ✅ 已完成遷移       |
| `/compare`       | `$state`（無頭 UI）      | ❌                  |
| `/trash`         | Context `$state`         | ❌                  |
| `/tagger`        | Context `$state`         | ❌                  |
| `/settings`      | `window.location.search` | ⚠️ 僅 alert 參數    |
| `/editor/[id]`   | route param              | ✅ 已使用           |

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

### 2.3 `/editor`（圖片編輯器列表）✅ 已完成

**表單參數**：`search`、`tags`、`rating`、`ratingOp`、`sort`、`order`、`page`

**現況**：已完成 URL query params 遷移。所有篩選與分頁狀態皆由 URL 驅動，移除了原本的 `EditorContext`。

**實作方式**：

- **`+page.server.ts`**：透過 `parseQueryParams(url)` 從 URL 讀取篩選條件，SSR 階段即依據 params 查詢資料庫（`queryImages(db, { ...parseQueryParams(url), limit: 30 })`），消除了頁面載入後的首次 client API 呼叫。
- **`editorForm.svelte.ts`**：`createEditorForm()` 工廠函數從 `page.url` 初始化所有篩選狀態。篩選變更時透過 `goto('/editor${qs}', { replaceState: true, noScroll: true, keepFocus: true })` 更新 URL。搜尋文字以 300ms debounce 觸發導航，其餘篩選條件即時觸發。透過 `afterNavigate` 監聽 `popstate` 事件，確保瀏覽器返回時篩選狀態能從 URL 同步還原。
- **`editorPagination.svelte.ts`**：`handlePageClick()` 複製當前 URL 的所有 params 並更新 `page` 參數（首頁時省略 `page` param），透過 `goto()` 導航。
- **`+page.svelte`**：直接將 SSR `data.result`（`items`、`total`、`page`、`pages`）傳遞給子元件，不再需要 client-side API 呼叫。
- **共用工具**：`parseQueryParams()`（URL → options）與 `buildQueryString()`（options → URL）定義於 `$lib/utils.ts`，前後端共用。

**URL 格式範例**：

```
/editor?search=cat&tags=animal,cute&rating=3&sort=rating&order=desc&page=2
```

---

### 2.4 `/scroll`（瀑布流捲動瀏覽）✅ 已完成

**表單參數**：`tags`、`rating`、`ratingOp`、`sort`、`order`

**現況**：已完成 URL query params 遷移。所有篩選狀態皆由 URL 驅動，移除了原本的 `ScrollContext`（`context.svelte.ts` 已刪除）。`columns` 作為 UI 偏好不入 URL，保留為 `+page.svelte` 的 `$state`。

**實作方式**：

- **`+page.server.ts`**：透過 `parseQueryParams(url)` 從 URL 讀取篩選條件，SSR 階段即依據 params 查詢資料庫（`queryImages(db, parseQueryParams(url))`），不設 `limit`（瀑布流不分頁）。消除了原本的全量載入與 client API 呼叫。
- **`scrollForm.svelte.ts`**：`createScrollForm()` 工廠函數從 `page.url` 初始化所有篩選狀態。篩選變更時透過 `goto('/scroll${qs}', { replaceState: true, noScroll: true, keepFocus: true })` 更新 URL。透過 `afterNavigate` 監聯 `popstate` 事件，確保瀏覽器返回時篩選狀態能從 URL 同步還原。
- **`scrollMasonry.svelte.ts`**：改為 `options` 模式接收 `items`、`columns`（getter/setter）、`pageContentEl`，`onMount` 時以 `detectBreakpoint()` 透過 setter 回寫初始欄數。
- **`scrollFab.svelte.ts`**：改為 `options` 模式接收 `pageContentEl`。
- **`+page.svelte`**：接收 SSR `data`，宣告 `columns`（`$state`）與 `pageContentEl`（`$state`），以 props / `bind` 傳遞給子元件。載入狀態改用 SvelteKit 內建的 `navigating` store。
- **Context 移除**：刪除 `context.svelte.ts`，所有子元件改為透過 props / `bind` 接收資料，符合 `frontend.md` §1.2 規範。

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

| 優先級  | 路由        | 收益 | 改動成本 | 說明                                                       |
| ------- | ----------- | ---- | -------- | ---------------------------------------------------------- |
| ✅ 完成 | `/editor`   | 高   | —        | 已完成遷移：SSR 依據 URL params 查詢、篩選/分頁皆 URL 驅動 |
| ✅ 完成 | `/scroll`   | 高   | —        | 已完成遷移：移除 Context、SSR 依據 URL params 查詢、props/bind 傳遞 |
| 🔶 P1   | `/trash`    | 中   | 低       | 搜尋 + 分頁，結構簡單，改造後可複用 `/editor` 的模式       |
| 🔶 P2   | `/compare`  | 低   | 低       | 只有兩個篩選參數，但隨機性質降低了 URL 化的實際收益        |
| ❌ —    | `/browse`   | 無   | —        | 一次性設定頁，最終結果已在 `/browse/player` URL 中         |
| ❌ —    | `/tagger`   | 無   | —        | 工作流工具，非搜尋/瀏覽場景                                |
| ❌ —    | `/settings` | 無   | —        | 操作型設定表單，非篩選場景                                 |
