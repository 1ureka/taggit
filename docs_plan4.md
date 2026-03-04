# Image Manager — SvelteKit 實作計畫 v4

> **撰寫**：2026-03-03，基於對全部 codebase 的自動化深度掃描
> **取代**：`docs_plan3.md`（前端進度已遠超 plan3 描述，plan3 的前端狀態描述已完全過時）
> **必讀**：實作者必須先閱讀本文件再動手，**不可跳過任何 section**

---

## 〇、專案定位

**私人本地工具**——管理本地圖片集的 tagging / rating / browsing 工具。
單人使用、不部署雲端、不對外公開。

---

## 一、完成度總覽

| 領域 | 狀態 | 備註 |
|------|------|------|
| 後端核心模組 | ✅ 100% | config / db / db-query / db-mutation / helpers / validation |
| 共用型別 + 工具 | ✅ 100% | types.ts / utils.ts |
| Client 工具 | ✅ 100% | api.ts / float.ts / toast.ts |
| Hooks | ✅ 100% | redirect guard + graceful shutdown |
| API 端點（21 個） | ✅ 100% | 含上傳端點 `POST /api/staged` |
| 圖片代理 | ✅ 100% | `/img/[area]/[file]` |
| 全域樣式 | ✅ 100% | app.css + app-basic.css + 6 元件 CSS |
| 共用元件（11 個） | ✅ 100% | 含計畫外 Select + TooSmallOverlay |
| 首頁 `/` | ✅ 100% | SSR stats + 導航卡片 |
| Setup `/setup` | ✅ 100% | 表單 + alert |
| Tagger `/tagger` | ✅ 100% | 三欄佈局 + 6 子元件 |
| Editor `/editor` | ✅ 100% | 搜尋/編輯雙模式 + 3 子元件 |
| Compare `/compare` | ✅ 100% | 隨機配對 + 篩選 |
| Scroll `/scroll` | ✅ 100% | 垂直瀏覽 + 虛擬化 + Masonry 佈局 |
| **Browse `/browse`** | **❌ 佔位符** | 顯示「尚未實作」 |

**結論：全專案只剩 Browse 一個頁面需要實作。**

---

## 二、技術堆疊現況

| 項目 | 實際使用 |
|------|----------|
| 框架 | SvelteKit 2.50+ / Svelte 5.51+ (runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`) |
| 語言 | TypeScript (strict) |
| 運行時 | adapter-node |
| 依賴 | `@floating-ui/dom`（浮動定位）、`@tabler/icons-svelte`（圖標） |
| 狀態管理 | SSR load → page data；client state 用 Svelte 5 runes；toast 用 writable store |
| API 呼叫 | client-heavy 頁面用 `$lib/client/api.ts`（thin fetch wrapper） |
| 衝突處理 | PATCH 帶 `expectedUpdatedAt`，409 → 提示重新整理 |

---

## 三、後端架構（已完成，僅供參考）

### 3.1 模組結構

```
src/lib/
  types.ts                  型別定義（client + server 共用）
  utils.ts                  工具函式（client + server 共用）
  client/
    api.ts                  client fetch 封裝（get/post/patch/del）
    float.ts                Svelte action，@floating-ui/dom 浮動定位
    toast.ts                Toast store + addToast()
  server/
    config.ts               server.json I/O + 路徑管理
    db.ts                   JSONDatabase 類別 + HMR-safe singleton
    db-query.ts             純讀查詢（接受 db 實例）
    db-mutation.ts          寫入/變更（接受 db 實例）
    helpers.ts              路由共用 helpers（server-only）
    validation.ts           輸入驗證（pure functions）
```

### 3.2 完整 API 端點列表

| # | Method | Path | 說明 |
|---|--------|------|------|
| 1 | GET | `/api/setup` | 取得 collectionRoot |
| 2 | POST | `/api/setup` | 設定 collectionRoot |
| 3 | GET | `/api/images` | 查詢圖片（filter/sort/pagination/search） |
| 4 | GET | `/api/images/[id]` | 取單筆 |
| 5 | PATCH | `/api/images/[id]` | 更新 tags/rating（帶 `expectedUpdatedAt`） |
| 6 | DELETE | `/api/images/[id]` | 移入 trash + 刪除 DB record |
| 7 | GET | `/api/staged` | 列出 staged 檔案 |
| 8 | POST | `/api/staged` | **上傳圖片到 staged**（multipart/form-data） |
| 9 | POST | `/api/staged/[filename]` | Commit staged → committed |
| 10 | DELETE | `/api/staged/[filename]` | Trash staged 檔案 |
| 11 | GET | `/api/trash` | 列出 trash 檔案 |
| 12 | DELETE | `/api/trash` | 清空 trash |
| 13 | POST | `/api/trash/[filename]` | 還原到 staged |
| 14 | DELETE | `/api/trash/[filename]` | 永久刪除單筆 |
| 15 | GET | `/api/metadata/tags` | 列出所有 tag（依 count 降冪） |
| 16 | POST | `/api/metadata/tags` | Rename tag（`{ oldName, newName }`） |
| 17 | GET | `/api/metadata/stats` | Collection 統計 |
| 18 | GET | `/api/maintenance/orphans` | 列出孤立檔案 |
| 19 | DELETE | `/api/maintenance/orphans` | 刪除孤立檔案 |
| 20 | GET | `/api/maintenance/missing` | 列出缺失記錄 |
| 21 | DELETE | `/api/maintenance/missing` | 移除缺失記錄 |
| 22 | POST | `/api/maintenance/backup` | 建立 db.json 備份 |
| — | GET | `/img/[area]/[file]` | 圖片代理（committed/staged/trash） |

### 3.3 API Response 取值路徑

```
GET  /api/staged              → res.data.files       (string[])
POST /api/staged              → res.data.{added, errors}  (string[], string[])
POST /api/staged/[filename]   → res.data.{id, record}
DEL  /api/staged/[filename]   → res.data.trashName
GET  /api/images              → res.data (QueryResult: {items, total, page, limit, totalPages})
GET  /api/images/[id]         → res.data (ImageWithId)
GET  /api/metadata/tags       → res.data.tags         (TagInfo[])
GET  /api/metadata/stats      → res.data.{totalImages, totalTags, stagedCount, trashCount}
GET  /api/trash               → res.data.files        (string[])
POST /api/trash/[filename]    → res.data.stagedName
DEL  /api/maintenance/orphans → res.data.deleted       (string[])
DEL  /api/maintenance/missing → res.data.removed       (string[])
POST /api/maintenance/backup  → res.data.backupPath
POST /api/metadata/tags       → res.data.affected      (number)
```

---

## 四、共用元件庫（已完成，僅供參考）

### 4.1 元件清單

| 元件 | 路徑 | 用途 |
|------|------|------|
| `Alert.svelte` | `src/lib/components/` | info / error / default 三色 alert |
| `ConfirmModal.svelte` | `src/lib/components/` | 確認對話框（overlay + modal, callback 式） |
| `Toast.svelte` | `src/lib/components/` | 全域 toast 通知（訂閱 toast store） |
| `Rating.svelte` | `src/lib/components/` | 5 星評分（bindable value, click toggle） |
| `TagChips.svelte` | `src/lib/components/` | Tag chip 列表（可移除/靜態） |
| `TagAutocomplete.svelte` | `src/lib/components/` | 標籤自動補全輸入（鍵盤導航, @floating-ui） |
| `FilterBar.svelte` | `src/lib/components/` | 整合篩選列（tags + rating + ratingOp + sort + order） |
| `ImagePreview.svelte` | `src/lib/components/` | 滾輪縮放 + 拖曳平移 + 雙擊重設 |
| `ImageCard.svelte` | `src/lib/components/` | 縮圖卡片（lazy load + footer info） |
| `Select.svelte` | `src/lib/components/` | 自訂 dropdown select（FilterBar 子元件） |
| `TooSmallOverlay.svelte` | `src/lib/components/` | 視窗過小遮罩 |

### 4.2 樣式架構

```
src/lib/styles/
  app.css              全域 reset + CSS 變數 + keyframes（150 行）
  app-basic.css        按鈕/input/chip/modal/rating/progress 等原子 class（270 行）
  FilterBar.css        FilterBar 專用
  ImageCard.css        ImageCard 專用
  Select.css           Select 專用
  TagAutocomplete.css  TagAutocomplete 專用
  Toast.css            Toast 專用
  TooSmallOverlay.css  TooSmallOverlay 專用
```

全域樣式由 `+layout.svelte` → `$lib/styles/app.css` 引入。
暗色主題 CSS 變數包含：`--bg`, `--bg-card`, `--bg-hover`, `--bg-active`, `--border`, `--border-hover`, `--text`, `--text-muted`, `--text-dim`, `--accent`, `--destructive`, `--ring`, `--radius`, `--font`, `--font-mono`。
4 組 keyframes：`fadeIn`, `slideUp`, `scaleIn`, `shimmer`。

---

## 五、已完成頁面摘要（僅供參考）

### 5.0 首頁 `/`
- SSR load 統計數據 + 5 張導航卡片 + 底部設定連結
- slide-up 動畫進場

### 5.1 Setup `/setup`
- 表單設定 collectionRoot，URL query alert 參數顯示提示
- POST → `/api/setup`，成功後導向首頁

### 5.2 Tagger `/tagger`（最複雜）
- 三欄佈局：Sidebar（縮圖列表 + 上傳）→ Preview（縮放/平移）→ TagPanel（評分/標籤/提交）
- 6 個子元件：TaggerHeader, TaggerSidebar, TaggerPreview, TaggerTagPanel, TaggerToolsModal, RenameTagModal
- 完整鍵盤快捷鍵（←→切換, 1-5 評分, T 聚焦, C 複製, Enter 提交, Delete 刪除）
- 進度條、確認對話框、工具 Modal（維護功能）、TooSmallOverlay
- Sidebar 選取、Crtl, Shift 多選、批次 commit、刪除（移入 trash）
- Client-heavy：`$lib/client/api.ts` fetch

### 5.3 Editor `/editor`
- 雙模式：無 `?id` → 搜尋（FilterBar + 分頁 grid）；有 `?id` → 編輯
- 3 個子元件：EditorSearch, EditorPreview, EditorInfoPanel
- 自動儲存：dirty flag + debounce 800ms → PATCH + 409 衝突偵測
- 鍵盤：Ctrl+S 手動存、Escape 返回

### 5.4 Compare `/compare`
- 隨機配對並排顯示（`sort=random&limit=2`）
- 標籤 + 評分篩選，符合數量即時更新
- 點擊開啟 Editor（新分頁），Space 換一組
- 不足兩張時 empty state

### 5.5 Scroll `/scroll`
- 虛擬化 + Masonry 佈局（`createWeightBasedLayout`）
- 篩選列（FilterBar）
- 無限捲動
- FAB 回到頂部
- 雙擊開 Editor（新分頁）

---

## 七、待實作：Browse `/browse`

### ⚠ 此節刻意不寫具體 UI 規格

Browse 是本專案**最 client-heavy 的頁面**，涉及 canvas 級的 DOM 操作（requestAnimationFrame 動畫迴圈、虛擬化、DOM 池化、無限循環捲動）。其使用者體驗設計複雜且細膩，無法在計畫文件中精確規格化而不失真。

### 7.1 必讀參考

實作者**必須完整閱讀以下檔案**，理解 Browse 頁面提供的**最終使用者體驗**：

```
old-ref/public/browse/index.html
old-ref/public/browse/app.js
old-ref/public/browse/style.css
```

> **注意**：參考的是**最終使用者體驗**（用戶看到什麼、怎麼操作、什麼感受），
> **不是實作方式**（舊版用原生 DOM 操作，新版可以自由選擇 Svelte reactivity、canvas、或任何手段）。
> 體驗必須**一致或更好**，背後怎麼實作不設限。

### 7.2 體驗概述（僅為導讀，不可取代實際閱讀 old-ref）

Browse 頁面是一個**兩階段沉浸式瀏覽工具**：

**第一階段（篩選畫面）**：
- 居中卡片式表單，讓使用者設定標籤、最低評等、排序方式
- 即時顯示符合數量
- 「開始瀏覽」按鈕進入播放

**第二階段（播放畫面）**：
- 全黑背景的水平自動捲動播放器
- 圖片全高排列成無間距的水平帶，無限循環
- 底部控制列：暫停/播放、進度條、速度滑桿、返回篩選
- 控制列 idle 後自動隱藏，滑鼠移動恢復
- 單擊暫停/播放，雙擊在新分頁開啟 Editor
- 鍵盤：Space 暫停/播放，Escape 返回篩選

### 7.3 API 呼叫

| 時機 | API |
|------|-----|
| 載入 tags | `GET /api/metadata/tags`（SSR 或 client） |
| 即時計數 | `GET /api/images?limit=1&page=1&tags=...&rating=...&ratingOp=gte` → 取 `total` |
| 載入全部圖片 | 多頁 `GET /api/images?page=N&limit=200&...` 直到全部載完 |

### 7.4 SSR 策略

- `+page.server.ts`：預載 `allTags`
- 篩選畫面的 UI 可用 Svelte reactivity
- 播放畫面的 DOM 操作**建議在 `onMount` 裡直接操作**，不走 Svelte reactive system

### 7.5 實作自由度

以下方面實作者可自由決定，只要最終體驗等同或更優：

- Svelte reactivity vs 手動 DOM vs canvas
- requestAnimationFrame loop 的具體架構
- 虛擬化策略（viewport ± N px、DOM 池化、或其他方案）
- 圖片預載策略
- 動畫/過渡效果的實現方式

---

## 八、強制規範（修訂版）

### 規範 A：實作前必先閱讀 old-ref

每個頁面必須**逐行閱讀** `old-ref/public/<頁面>/app.js` + `index.html` + `style.css`。
色彩、間距、字型、按鈕位置、操作順序、提示訊息文字（中文），**全部與 old-ref 一致**。

### 規範 B：API response 格式

見本文件**第 3.3 節**。取資料時使用正確的 key 路徑。
特別注意：
- `GET /api/metadata/tags` → `res.data.tags`（**非** `/api/tags`）
- `GET /api/trash` → `res.data.files`（**非** `items`）
- 隨機配對 = `GET /api/images?sort=random&limit=2` → `res.data.items`（**無** `/api/random-pair` 端點）

### 規範 C：tags rename 欄位

Body 必須使用 `{ oldName, newName }`，端點為 `POST /api/metadata/tags`。

### 規範 D：PATCH 必帶 expectedUpdatedAt

`PATCH /api/images/[id]` 都必須帶 `expectedUpdatedAt`。
200 → 更新本地 `updatedAt`。409 → toast **「此圖片已被修改，請重新整理」**。

### 規範 E：commit 至少一個 tag

`POST /api/staged/[filename]` 空 tags → 400。前端應先擋（toast error）。

### 規範 F：不需要 WebSocket

所有 old-ref 中的 WS 行為一律刪除。

### 規範 G：db.ts 只管資料

**絕對不要**把 `fs.*` 呼叫放進 `db.ts` / `db-query.ts` / `db-mutation.ts`。

### 規範 H：random-pair = query 的特例

Compare 頁面用 `GET /api/images?sort=random&limit=2&...`，回傳 `QueryResult`。

### 規範 I：staged trash 不加前綴

使用 `uniqueFilename()` 處理衝突，不加時間戳前綴。

### 規範 J：image ID 格式

`crypto.randomBytes(8).toString("hex")` → 16 字元小寫 hex（`^[0-9a-f]{16}$`）。

### 規範 K：Svelte 5 runes

全專案使用 Svelte 5 runes（`$state`, `$derived`, `$effect`, `$props`, `$bindable`）。
**不使用** Svelte 4 的 `export let`、`$:` reactive statements、`createEventDispatcher`。

### 規範 L：元件回調風格

使用 callback props（`onselect`, `onchange`, `onconfirm` 等），**不使用** `dispatch` 事件。
這是現有所有元件已統一遵循的模式。

### 規範 M：浮動定位

需要 dropdown/popup 的元件統一使用 `$lib/client/float.ts`（基於 `@floating-ui/dom`）。

---

## 十、收尾驗證清單

- [ ] Browse filter：即時計數正確、0 張時按鈕停用
- [ ] Browse player：1000+ 張圖流暢（虛擬化 + 池化）
- [ ] Browse player：無限循環無跳躍
- [ ] Browse player：速度/進度控制正常
- [ ] Browse player：Dock 自動隱藏 + 滑鼠恢復
- [ ] Browse player：單擊暫停、雙擊開 Editor
- [ ] Browse player：Escape 返回篩選、Space 暫停
- [ ] Browse player：視窗 resize 後佈局正確

---

## 十一、已知差異與補遺

### 11.1 plan3 未記錄的端點

`POST /api/staged`（無 `[filename]`）為**檔案上傳端點**，接收 `multipart/form-data`（欄位名 `files`），回傳 `{ added: string[], errors: string[] }`。Tagger 的 sidebar 拖曳上傳功能使用此端點。plan3 §4.3 漏列。

### 11.2 filterIds 簽名擴充

`db-query.ts` 的 `filterIds` 實際簽名為 `filterIds(db, search, tags, rating, ratingOp)`，比 plan3 表格多了 `search` 參數，支援 filename substring 搜尋。這是功能增強，非偏差。

### 11.3 Editor 還原功能

採用 plan3 方案 A：Editor 刪除圖片後返回搜尋，**無「還原」按鈕**。需要還原請至 Tagger 工具（trash → staged → recommit）。`POST /api/images/[id]/restore` 端點**不存在且不實作**。

### 11.4 ConfirmModal 風格

plan2 原設計為 Promise-based API，實際實作為 **callback 式**（`onconfirm` / `oncancel` props）。所有使用處已統一此模式。

### 11.5 額外元件

- `Select.svelte`：FilterBar 的必要子元件，plan2 未明確列出
- `TooSmallOverlay.svelte`：視窗過小防呆覆蓋層，plan2 未提及

---

## 十二、頁面互動強度

| 頁面 | SSR | Client | 狀態 |
|------|-----|--------|------|
| `/setup` | ● | ○ 表單 | ✅ 完成 |
| `/` | ● | ○ | ✅ 完成 |
| `/scroll` | ◐ | ◐ | ✅ 完成 |
| `/compare` | ◐ | ◐ | ✅ 完成 |
| `/editor` | ◐ | ● | ✅ 完成 |
| `/tagger` | ◐ | ● | ✅ 完成 |
| `/browse` | ◐ | ● | ❌ 待實作 |

---

## 十三、頁面導航流

```
Index (/)
  ├→ /tagger        ✅
  ├→ /editor        ✅
  ├→ /browse        ❌ 待實作
  ├→ /scroll        ✅
  ├→ /compare       ✅
  └→ /setup         ✅

Browse filter → Browse player (internal switch)
Browse player → Browse filter (篩選 btn / Escape)
Browse player → /editor?id={id} (dblclick, new tab)
```
