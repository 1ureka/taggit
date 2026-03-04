# src/lib 完整檔案文件

> 最後更新：2026-03-04

本文件記錄 `src/lib/` 下每個檔案的作用、對外介面以及現狀。

---

## 目錄結構

```
src/lib/
├── types.ts                        # 全域 TypeScript 型別
├── utils.ts                        # 通用工具函式（client/server 皆可用）
├── assets/
│   └── favicon.svg                 # Svelte logo favicon
├── client/
│   ├── api.ts                      # 瀏覽器端 fetch 封裝
│   ├── float.ts                    # Floating UI Svelte action
│   ├── toast.ts                    # Sonner 風格 toast store
│   └── use-zoom-pan.svelte.ts      # 圖片縮放/平移 reactive 狀態
├── components/
│   ├── Alert.svelte                # 靜態提示條
│   ├── ConfirmModal.svelte         # 確認對話框
│   ├── FilterBar.svelte            # 篩選列（標籤 + 評分 + 排序）
│   ├── Rating.svelte               # 星級評分元件
│   ├── Select.svelte               # 自訂下拉選擇器
│   ├── SelectCheckbox.svelte       # 圖片多選核取方塊
│   ├── TagAutocomplete.svelte      # 標籤自動完成輸入框
│   ├── TagChips.svelte             # 標籤 chip 列表
│   ├── Toast.svelte                # Toast 通知渲染元件
│   └── TooSmallOverlay.svelte      # 視窗過小遮罩
├── server/
│   ├── config.ts                   # server.json 讀寫 + 集合判斷
│   ├── db.ts                       # JSONDatabase 類別 + HMR 安全 singleton
│   ├── db-query.ts                 # 純讀取查詢函式
│   ├── db-mutation.ts              # 寫入/異動函式
│   ├── helpers.ts                  # API 路由共用幫手函式
│   └── validation.ts              # 純驗證函式
└── styles/
    ├── app.css                     # 全域 CSS（主題變數、reset、字型）
    ├── app-basic.css               # 基礎 UI 元件樣式
    ├── FilterBar.css               # FilterBar 佈局
    ├── Select.css                  # Select 下拉樣式
    ├── TagAutocomplete.css         # 自動完成下拉樣式
    └── TooSmallOverlay.css         # 遮罩樣式
```

---

## types.ts

**用途**：定義專案所有共享的 TypeScript 介面，client/server 兩端皆匯入。

### 匯出的型別

| 介面 | 說明 |
|------|------|
| `ImageRecord` | 單一圖片的資料欄位：`ext`、`originalName`、`tags`、`rating`、`committedAt`、`updatedAt`、`fileSize`、`width`、`height` |
| `ImageWithId` | `ImageRecord` + `id` 欄位，用於查詢結果 |
| `ServerConfig` | server.json 的結構：`collectionRoot?` |
| `CollectionPaths` | 由 collection root 派生的五個路徑：`root`、`staged`、`committed`、`trash`、`db` |
| `DBData` | db.json 的頂層結構：`version` + `images` 字典 |
| `QueryOptions` | 統一查詢參數：`search`、`tags`、`rating`、`ratingOp`、`sort`、`order`、`page`、`limit` |
| `QueryResult` | 查詢結果封裝：`items`、`total`、`page`、`pages` |
| `TagInfo` | 標籤資訊：`name` + `count` |
| `Stats` | 全域統計：`totalImages`、`totalTags`、`stagedCount`、`trashCount` |
| `ApiResponse<T>` | API 統一回傳格式：`ok`、`data?`、`error?` |

### 現狀

- `width` / `height` 有可能為 `0`（表示未知），因為目前由前端在 commit 時計算後傳入，若前端計算失敗則寫入 0。
- 無重大待修改事項。

---

## utils.ts

**用途**：通用工具函式，client 與 server 皆可安全匯入（無 Node / 瀏覽器專有 API）。

### 匯出的函式

| 函式 | 簽名 | 說明 |
|------|------|------|
| `parseTags` | `(raw: string \| null) → string[]` | 逗號分隔字串 → 標籤陣列 |
| `parseQueryParams` | `(url: URL) → QueryOptions` | 從 URL searchParams 解析查詢選項 |
| `formatDate` | `(ms: number) → string` | Unix ms → locale 日期字串 |
| `formatSize` | `(bytes: number) → string` | bytes → 可讀大小（B / KB / MB / GB） |
| `debounce` | `(fn, ms) → fn` | 防抖 |
| `throttle` | `(fn, ms) → fn` | 節流 |

### 現狀

- 功能完整，無已知問題。

---

## assets/favicon.svg

**用途**：靜態 Svelte logo SVG，作為 favicon 使用。

### 現狀

- 尚未替換為專案客製 icon。

---

## client/api.ts

**用途**：瀏覽器端輕量 `fetch` 封裝，供所有客戶端頁面呼叫 SvelteKit API 使用。

### 匯出

| 用法 | 說明 |
|------|------|
| `api.get<T>(url)` | GET 請求 |
| `api.post<T>(url, body?)` | POST 請求 |
| `api.patch<T>(url, body?)` | PATCH 請求 |
| `api.del<T>(url, body?)` | DELETE 請求 |

### 行為

- JSON 序列化請求體，自動加 `Content-Type: application/json`。
- 自動解包 server 的 `{ ok, data }` 信封，回傳 `{ ok, data?, error?, status }`。
- 非 OK 回應提取 `error` 欄位或使用 `statusText`。

### 現狀

- 無已知問題。

---

## client/float.ts

**用途**：Svelte action，使用 `@floating-ui/dom` 將浮動元素定位在參考元素旁。用於 `Select` 和 `TagAutocomplete` 的下拉選單。

### 匯出

| 項目 | 說明 |
|------|------|
| `FloatOptions` | 設定介面：`reference`、`open`、`placement`、`offset`、`matchWidth`、`matchMinWidth`、`middleware` |
| `float(node, opts)` | Svelte action，portal 到 `<body>` 並以 `position: fixed` 定位 |

### 設計要點

- 使用 `strategy: 'fixed'` 避免浮動元素影響 `document.scrollWidth`，消除溢出問題。
- 透過 `autoUpdate` 自動在 scroll/resize/layout shift 時重新定位。
- `data-open` attribute 控制 CSS 顯示/隱藏動畫。

### 現狀

- 功能穩定。

---

## client/toast.ts

**用途**：Sonner 風格 toast 通知 store，管理通知的新增、移除、暫停/恢復計時。

### 匯出

| 項目 | 說明 |
|------|------|
| `ToastType` | `"success" \| "error" \| "info"` |
| `ToastItem` | 每筆 toast 的完整資料（含 `removing`、`remaining`） |
| `toasts` | Svelte readable store，供 `Toast.svelte` 訂閱 |
| `addToast(message, type?, duration?)` | 新增 toast，回傳 id |
| `dismissToast(id)` | 觸發退場動畫 |
| `finalizeRemoval(id)` | 動畫結束後從 store 移除 |
| `pauseAll()` | hover 時暫停所有計時器 |
| `resumeAll()` | hover 結束恢復計時 |

### 設計要點

- 最多顯示 5 筆（`MAX_VISIBLE`），超出的自動 dismiss。
- `removing` flag 啟動 CSS 退場動畫，`transitionend` 後才實際刪除。
- 計時器以 module-scoped `Map` 維護，hover pause/resume 靠快照 `remaining`。

### 現狀

- 功能穩定。

---

## client/use-zoom-pan.svelte.ts

**用途**：可複用的圖片縮放/平移 reactive 狀態，供 Tagger preview 和 Editor 等頁面使用。

### 匯出

| 函式 | 說明 |
|------|------|
| `useZoomPan(opts?)` | 產生並回傳縮放/平移狀態物件 |

### 回傳的物件屬性

| 成員 | 說明 |
|------|------|
| `scale`, `panX`, `panY` | 只讀 reactive getters |
| `isDragging` | 是否正在拖曳 |
| `transform` | 算好的 CSS `transform` 字串 |
| `reset()` | 重設為 1x, 0,0 |
| `onWheel`, `onMousedown`, `onWindowMousemove`, `onWindowMouseup` | 事件處理器 |

### 設計要點

- 使用 Svelte 5 `$state` rune。
- 預設縮放範圍 0.2x–10x，可選配。

### 現狀

- 功能穩定。

---

## components/Alert.svelte

**用途**：靜態提示條元件，用於頁面上顯示 info / error / warning 訊息。

### Props

| Prop | 型別 | 預設 | 說明 |
|------|------|------|------|
| `type` | `"info" \| "error" \| "default"` | `"default"` | 決定顏色及圖示 |
| `message` | `string` | （必填） | 訊息文字 |

### 現狀

- 目前只在 `/setup` 路由使用。

---

## components/ConfirmModal.svelte

**用途**：通用確認對話框，顯示訊息並提供「確認」/「取消」兩個按鈕。

### Props

| Prop | 型別 | 說明 |
|------|------|------|
| `message` | `string` | 提示訊息 |
| `onconfirm` | `() → void` | 按下確認的 callback |
| `oncancel` | `() → void` | 按下取消或 Escape 的 callback |

### 行為

- overlay 點擊 → 取消
- Escape → 取消

### 現狀

- 被 tagger / trash / browse 等多個路由使用。

---

## components/FilterBar.svelte

**用途**：通用篩選列，包含標籤篩選、評分篩選、排序選項。

### Props

| Prop | 型別 | 說明 |
|------|------|------|
| `allTags` | `TagInfo[]` | 可用標籤列表 |
| `selectedTags` | `string[]` (`$bindable`) | 已選標籤 |
| `rating` | `number \| undefined` (`$bindable`) | 評分篩選 |
| `ratingOp` | `"gte" \| "lte" \| "eq"` (`$bindable`) | 比較運算子 |
| `sort` | `string` (`$bindable`) | 排序欄位 |
| `order` | `string` (`$bindable`) | 排序方向 |
| `onchange` | `() → void` | 任何值變更時的 callback |

### 組成

- 上方：標籤 chip 列 + `TagAutocomplete`
- 下方：6 欄 grid（評分運算子、評分值、排序欄位、排序方向）

### 現狀

- 被 `/scroll`、`/browse`、`/compare` 等瀏覽相關路由使用。

---

## components/Rating.svelte

**用途**：星級評分元件（1–5 星），支援互動模式和唯讀模式。

### Props

| Prop | 型別 | 預設 | 說明 |
|------|------|------|------|
| `value` | `number` (`$bindable`) | `0` | 當前評分 |
| `size` | `string` | `"1.25rem"` | 星星大小 |
| `readonly` | `boolean` | `false` | 唯讀模式 |
| `onchange` | `(v: number) → void` | — | 評分變更 callback |

### 行為

- 點擊已選取的星星可以歸零。
- hover 預覽效果（僅互動模式）。
- 使用 `@tabler/icons-svelte` 的 `IconStar` / `IconStarFilled`。

### 現狀

- 被多個路由使用（tagger、browse、scroll、editor）。

---

## components/Select.svelte

**用途**：自訂下拉選擇器，替代原生 `<select>`，使用 `float` action 定位。

### Props

| Prop | 型別 | 說明 |
|------|------|------|
| `value` | `string \| number \| undefined` (`$bindable`) | 已選值 |
| `options` | `{ value, label }[]` | 選項列表 |
| `size` | `"sm" \| "md"` | 尺寸 |
| `stretch` | `boolean` | 是否占滿寬度 |
| `onchange` | `() → void` | 變更 callback |

### 行為

- 點擊和鍵盤操作（Escape/Enter/Space）。
- Portal 到 `<body>`，避免溢出問題。

### 現狀

- 被 `FilterBar`、各路由使用。

---

## components/SelectCheckbox.svelte

**用途**：圖片卡片上的多選核取方塊，hover 時顯示、checked 時常駐。

### Props

| Prop | 型別 | 說明 |
|------|------|------|
| `checked` | `boolean` | 是否選取 |
| `size` | `"sm" \| "md" \| "lg"` | 尺寸變體 |
| `onchange` | `(checked: boolean) → void` | 變更 callback |

### 設計要點

- 使用 CSS `opacity` + `scale` 過渡動畫。
- 父容器需加 class `select-checkbox-host` 以觸發 `:hover` 顯示。

### 現狀

- 被 scroll、browse、trash 等路由使用。

---

## components/TagAutocomplete.svelte

**用途**：標籤自動完成輸入框，含下拉建議列表。

### Props

| Prop | 型別 | 說明 |
|------|------|------|
| `allTags` | `TagInfo[]` | 可用標籤（含 count） |
| `excludedTags` | `string[]` | 要排除的標籤（已選取的） |
| `placeholder` | `string` | placeholder 文字 |
| `onselect` | `(tag: string) → void` | 選取標籤 callback |
| `oncommit` | `() → void` | Enter（空值）callback |
| `onbackspace` | `() → void` | Backspace（空值）callback |

### 行為

- 鍵盤導航：ArrowUp/Down、Enter（選取/提交）、Tab（自動完成）、Escape、Backspace。
- 逗號（全形/半形）觸發即時選取。
- 下拉使用 `float` action portal 到 body。

### 現狀

- 被 tagger (TagPanel)、FilterBar 使用。

---

## components/TagChips.svelte

**用途**：標籤 chip 顯示列表，可選是否可移除。

### Props

| Prop | 型別 | 說明 |
|------|------|------|
| `tags` | `string[]` | 標籤陣列 |
| `onremove` | `(tag: string) → void` | 移除 callback（若提供，chip 變為可點擊） |

### 現狀

- 被 editor、scroll、browse 等路由使用。

---

## components/Toast.svelte

**用途**：Toast 通知渲染容器，Sonner 風格堆疊動畫。

### 行為

- 訂閱 `toasts` store，渲染通知列表。
- 折疊態（stack offset + scale down）→ hover 展開態。
- enter/exit 動畫全部由 CSS `transition` 驅動。
- `ResizeObserver` 測量個別 toast 高度用於展開態定位。
- 最多顯示 5 筆 (`MAX_VISIBLE`)。
- hover 時暫停所有倒計時。

### 現狀

- 掛載在 `+layout.svelte`，全域生效。

---

## components/TooSmallOverlay.svelte

**用途**：視窗尺寸不足時覆蓋全螢幕的警告畫面。

### Props

| Prop | 型別 | 說明 |
|------|------|------|
| `minWidth` | `number` | 最低寬度 |
| `minHeight` | `number` | 最低高度 |
| `currentWidth` | `number` | 目前寬度 |
| `currentHeight` | `number` | 目前高度 |
| `label` | `string` | 功能名稱 |

### 現狀

- 被 tagger、browse/player 使用。

---

## server/config.ts

**用途**：管理 `server.json` 設定檔和集合路徑。

### 常量

| 名稱 | 說明 |
|------|------|
| `IMG_EXTS` | 支援的圖片副檔名 Set：`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.avif` |
| `MIME_TYPES` | 副檔名 → MIME type 對映（含 `.svg`, `.ico`） |

### 匯出函式

| 函式 | 說明 |
|------|------|
| `ensureServerJson()` | 確保 server.json 存在，不存在則建立 `{}` |
| `getCollectionRoot()` | 讀取 server.json 的 `collectionRoot`，無則回傳 `null` |
| `setCollectionRoot(root)` | 寫入 `collectionRoot`，不會自動載入 DB |
| `isCollectionValid(root)` | 驗證路徑是否為合法目錄，自動建立 `staged/`、`committed/`、`trash/` 子目錄 |
| `getCollectionPaths(root)` | 從 root 派生 `CollectionPaths` 物件 |

### 設計要點

- `SERVER_JSON_PATH` 以 `path.resolve("server.json")` 定位，即 process CWD 目錄下。
- 所有 I/O 皆同步（`fs.readFileSync` / `fs.writeFileSync`）。

### 現狀

- 無快取目錄的概念（.cache 尚不存在）。

---

## server/db.ts

**用途**：核心 JSON 資料庫的類別定義、持久化機制、HMR 安全 singleton。

### 匯出

| 項目 | 說明 |
|------|------|
| `JSONDatabase` (class) | 完整的 DB 狀態封裝 |
| `getDB()` | 取得 HMR 安全的 globalThis singleton |

### JSONDatabase 成員

| 成員 | 說明 |
|------|------|
| `data: DBData` | 記憶體中的資料快照 |
| `tagIndex: Map<string, Set<string>>` | tag → image ids 反向索引 |
| `ratingIndex: Map<number, Set<string>>` | rating → image ids  反向索引 |
| `dirty: boolean` | 是否有未寫入的變更 |
| `flushTimer` | debounced flush 計時器 |
| `currentRoot: string \| null` | 當前集合根路徑 |
| `loaded: boolean` | 是否已載入 |
| `buildIndexes()` | 全量重建索引 |
| `indexAdd(id, rec)` | 增量加入索引 |
| `indexRemove(id, rec)` | 增量移除索引 |
| `markDirty()` | 標記並排程 500ms 後 flush |
| `flush()` | 原子式寫入（tmp → rename） |
| `loadCollection(rootPath)` | 切換/載入集合 |
| `isLoaded()` | 查詢載入狀態 |
| `getCurrentRoot()` | 查詢當前根路徑 |

### 現狀

- flush 機制穩定（debounce 500ms + atomic rename）。
- 索引提供高效的 tag/rating 查詢。

---

## server/db-query.ts

**用途**：純讀取函式，不修改任何狀態。

### 匯出函式

| 函式 | 說明 |
|------|------|
| `getImage(db, id)` | 取得單筆 `ImageWithId` 或 `null` |
| `hasImage(db, id)` | 是否存在 |
| `allImageEntries(db)` | 所有 `[id, record]` pair |
| `queryImages(db, opts?)` | 統一查詢：篩選 + 排序 + 分頁 |
| `filterIds(db, search, tags, rating, ratingOp)` | 內部篩選引擎（回傳 id Set） |
| `getAllTags(db)` | 所有標籤（按 count 降序） |
| `getImageCount(db)` | 圖片總數 |
| `getTagCount(db)` | 標籤種類總數 |

### 設計要點

- tag 篩選使用 AND 語義（交集）。
- 支援 `random` 排序（Fisher-Yates shuffle）。
- `limit = 0` 或 undefined 時回傳全部。

### 現狀

- 功能完整。

---

## server/db-mutation.ts

**用途**：寫入/異動函式，僅修改記憶體狀態與索引，不做檔案 I/O。

### 匯出函式

| 函式 | 說明 |
|------|------|
| `addImage(db, id, record)` | 新增圖片記錄 |
| `removeImage(db, id)` | 刪除記錄（回傳舊記錄） |
| `updateImage(db, id, patch, expectedUpdatedAt)` | 更新 tags/rating（含樂觀鎖定） |
| `renameTag(db, oldName, newName)` | 重命名標籤（跨所有圖片） |

### 設計要點

- `updateImage` 使用 `updatedAt` 做衝突偵測（409 Conflict）。
- `renameTag` 後全量 `buildIndexes()`。
- 每次異動後呼叫 `markDirty()` 排程持久化。

### 現狀

- 功能完整。

---

## server/helpers.ts

**用途**：API 路由共用幫手函式，消除重複的樣板程式碼。

### 匯出函式

| 函式 | 說明 |
|------|------|
| `guardLoaded()` | DB 未載入時回傳 503 Response，否則 `null` |
| `getPaths()` | `getCollectionPaths(getDB().getCurrentRoot()!)` 的簡寫 |
| `getStagedFiles()` | 讀取 staged/ 目錄的圖片檔名列表（排序） |
| `getTrashFiles()` | 讀取 trash/ 目錄的圖片檔名列表（排序） |
| `uniqueFilename(dir, name)` | 產生不重複檔名（`_1`, `_2` 後綴） |
| `parseBody<T>(request)` | 解析 JSON body，失敗回傳 400 Response |

### 現狀

- 功能完整，被幾乎所有 API 路由引用。

---

## server/validation.ts

**用途**：純驗證函式（無 I/O），server-side only。

### 匯出函式

| 函式 | 驗證規則 |
|------|------|
| `isValidId(v)` | 16 字元小寫 hex 字串 |
| `isValidTags(v)` | 字串陣列，元素非空、≤50 字元、唯一 |
| `isValidRating(v)` | 整數 0–5 |
| `isValidFilename(v)` | 無路徑分隔符、不以 `.` 開頭 |
| `isValidAbsPath(v)` | 非空字串 |

### 現狀

- 功能完整。

---

## styles/app.css

**用途**：全域入口 CSS，引入字型和基礎樣式。

### 內容

- 匯入 Google Fonts：Inter、JetBrains Mono、Noto Sans TC
- 匯入 `app-basic.css`
- CSS Reset（margin/padding/box-sizing）
- `:root` 主題變數（深色主題）：`--bg`、`--text`、`--accent`、`--destructive` 等
- 自訂 scrollbar 樣式
- 全域 selection / focus-visible 樣式
- `.visually-hidden` 無障礙輔助 class

### 現狀

- 僅支援深色主題。

---

## styles/app-basic.css

**用途**：跨路由共用的基礎 UI 元件 CSS class。

### 定義的 class

| 分類 | class | 說明 |
|------|-------|------|
| 按鈕 | `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-destructive`, `.btn-icon`, `.btn-sm` | 按鈕變體 |
| 輸入框 | `.input` | 基礎文字輸入 |
| Chip | `.chip`, `.chip-removable`, `.chip-remove` | 標籤 chip |
| 對話框 | `.modal-overlay`, `.modal`, `.modal-title`, `.modal-body`, `.modal-actions` | Modal 佈局 |
| 進度條 | `.progress-bar`, `.progress-bar-fill` | 進度條 |
| 鍵盤提示 | `.kbd` | 鍵盤快捷鍵提示 |
| Badge | `.badge` | 小型標記 |
| 分隔線 | `.separator` | 水平分隔線 |
| 骨架 | `.skeleton` | Shimmer 載入骨架 |

### 現狀

- 功能穩定。

---

## styles/FilterBar.css

**用途**：`FilterBar.svelte` 的佈局樣式。

### 內容

- `.filter-bar`：column flex 容器
- `.filter-tags-row`：wrap flex 列（chip + input）
- `.filter-controls`：6 欄 grid（`auto 1fr 1fr auto 1fr 1fr`）
- `.filter-label`：靜態標籤文字

### 現狀

- 功能穩定。

---

## styles/Select.css

**用途**：`Select.svelte` 的觸發器和下拉列表樣式。

### 內容

- `.select-trigger` / `.select-sm` / `.select-md` / `.select-stretch`：觸發按鈕
- `.select-chevron` / `.select-chevron-open`：箭頭旋轉動畫
- `.select-list`：固定定位的下拉面板（`position: fixed`）
- `.select-option` / `.select-option-active`：選項行

### 現狀

- 功能穩定。

---

## styles/TagAutocomplete.css

**用途**：`TagAutocomplete.svelte` 的下拉建議列表樣式。

### 內容

- `.ac-dropdown`：固定定位下拉面板
- `.ac-item` / `.ac-active`：建議項
- `.ac-item-name` / `.ac-item-count`：名稱 + 計數

### 現狀

- 功能穩定。

---

## styles/TooSmallOverlay.css

**用途**：`TooSmallOverlay.svelte` 的全螢幕遮罩樣式。

### 內容

- `.too-small-overlay`：固定定位 + 置中 flex
- `.too-small-card`：內容卡片
- `.too-small-icon` / `.too-small-title` / `.too-small-desc` / `.too-small-current`：子元素

### 現狀

- 功能穩定。
