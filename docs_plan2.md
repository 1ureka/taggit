# Image Manager — SvelteKit 遷移計畫 v2

> **撰寫**：2026-03-03，基於 old-ref 完整逐行分析
> **取代**：`docs_plan.md`（舊版計畫修補過多，已失去參考價值）
> **必讀**：實作者必須先閱讀本文件再動手，**不可跳過任何 section**

---

## 〇、專案定位

**私人本地工具**——管理本地圖片集的 tagging / rating / browsing 工具。
單人使用、不部署雲端、不對外公開。

---

## 一、技術決策

| 項目 | 決策 |
|------|------|
| 框架 | SvelteKit (adapter-node) + TypeScript |
| 即時同步 | **移除 WebSocket**。衝突在 PATCH 時以 `updatedAt` 偵測 |
| 狀態管理 | Server SSR load = single source of truth；不建全域 client store |
| 依賴 | svelte + @sveltejs/kit + typescript + @types/node，不引入額外 lib |
| 衝突處理 | PATCH 帶 `expectedUpdatedAt`，不符回 409，UI 提示 reload |

### 與 old-ref 的刻意差異

| old-ref | 新版 | 理由 |
|---------|------|------|
| WebSocket 即時同步 + 離線 overlay | 移除 WS；改用 conflict detection | 單人工具不需即時多端同步 |
| `POST /api/tags/rename` body `{from, to}` | body `{oldName, newName}` | 避免 `from` 保留字歧義 |
| staged trash 保留原始檔名 | 加前綴 `staged_{timestamp}_` | 防止與 committed ID 命名衝突 |
| backup 回傳 `{path: "basename"}` | 回傳 `{backupPath: "/full/path"}` | 前端可直接顯示完整路徑 |
| `PATCH /api/images/:id` 無衝突檢查 | 必帶 `expectedUpdatedAt` | 多分頁同時編輯的安全保障 |
| `POST /api/staged/commit-batch` | **刪除** | 死代碼，從未被任何前端使用 |

### API response 格式變更

新版所有 API 回傳 `{ ok: boolean, data?: {...}, error?: string }`。
具體子鍵對映見 `docs_plan.md` 規範 B（仍然有效）。

---

## 二、架構設計原則

### db.ts = 純資料層（已完成重構）

`src/lib/server/db.ts` **只管記憶體中的 record CRUD / 索引 / 持久化，絕不碰檔案系統**。

匯出的 API（~280 行）：

| 類別 | 函式 |
|------|------|
| 生命週期 | `flush`, `loadCollection`, `isLoaded`, `getCurrentRoot` |
| 單筆查詢 | `getImage`, `hasImage`, `getTrashedImage` |
| 批次查詢 | `listImages`, `listAllMatching`, `allImageEntries`, `listTrash` |
| 寫入 | `addImage`, `removeImage`, `updateImage`, `moveToTrash`, `restoreFromTrash`, `removeTrashedRecord`, `clearTrashRecords` |
| 標籤 | `getAllTags`, `renameTag` |
| 統計 | `getImageCount`, `getTagCount`, `getTrashCount` |

### Route = 業務完整體

每條 route 自己處理：

1. 輸入驗證
2. 檔案系統操作（rename / unlink / readdir / stat / copy）
3. 呼叫 db 的純資料函式
4. 組裝回應

### params.ts = 查詢參數解析

`src/lib/server/params.ts` 提供 `parseTags`, `parseListParams`, `parseFilterParams`
避免在多個 route 中重複寫醜陋的 searchParams 解析。

---

## 三、Phase 1 — Server 核心（✅ 已完成）

Phase 1 的所有工作已完成並通過驗證。包含：

- `src/lib/server/config.ts` — server.json I/O、路徑管理
- `src/lib/server/db.ts` — 純資料層 DB（已重構）
- `src/lib/server/params.ts` — 查詢參數解析
- `src/lib/server/validation.ts` — 輸入驗證
- `src/hooks.server.ts` — redirect guard + graceful shutdown
- 全部 API routes（20 個端點）
- 圖片代理 `img/[area]/[file]`
- Setup 頁面 + 首頁骨架

---

## 四、Phase 2 — 全域樣式 + 共用元件

### 2.1 全域樣式

> **來源**：`old-ref/public/shared/style.css` + `old-ref/public/shared/components.css`

建立 `src/app.css`（在 `+layout.svelte` 匯入）：

#### CSS Variables（暗色主題，必須 1:1 對映 old-ref）

```css
:root {
  --bg: #0a0a0a;
  --bg-card: #111111;
  --bg-hover: #1a1a1a;
  --bg-active: #222222;
  --border: #222222;
  --border-hover: #333333;
  --text: #fafafa;
  --text-muted: #a1a1aa;
  --text-dim: #71717a;
  --accent: #ffffff;
  --destructive: #ef4444;
  --ring: #d4d4d8;
  --radius: 6px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

#### 動畫（必須保留）

| Class | Keyframes | 效果 |
|-------|-----------|------|
| `.fade-in` | `fadeIn` 0.2s ease-out | opacity 0→1 |
| `.slide-up` | `slideUp` 0.3s ease-out | opacity 0→1 + translateY(8px→0) |
| `.scale-in` | `scaleIn` 0.2s ease-out | opacity 0→1 + scale(0.95→1) |
| `.skeleton` | `shimmer` 1.5s infinite | 漸層左右移動 loading |

#### 按鈕體系

| Class | 說明 |
|-------|------|
| `.btn` | 基礎：bg-card, border, 0.5rem 1rem, 0.875rem weight 500 |
| `.btn-primary` | 白底黑字 |
| `.btn-ghost` | 透明底 + 邊框 |
| `.btn-destructive` | 透明底, 紅字 + 紅框 |
| `.btn-icon` | 0.5rem padding, 2rem×2rem |
| `.btn-sm` | 0.25rem 0.625rem, 0.8125rem |

#### Chip / Rating / Progress / Kbd / Badge / Skeleton

全部從 `old-ref/public/shared/components.css` 搬過來，保持原樣。

### 2.2 Svelte 共用元件 → `src/lib/components/`

#### Toast.svelte

> **來源**：`old-ref utils.js → toast()`

- 容器 fixed top-right, z-index 2000
- 類型：`success` (綠左框) / `error` (紅左框) / `info` (灰左框)
- 動畫：slideUp 0.25s 進場，3000ms 後 fadeOut 200ms
- 用 Svelte store 驅動（`src/lib/stores/toast.ts`）
- `addToast(message, type)` 函式供全域呼叫

#### ConfirmModal.svelte

> **來源**：`old-ref utils.js → confirm()`

- Overlay: fixed inset 0, rgba(0,0,0,0.7), fadeIn 0.15s
- Modal: bg-card, radius*2, scaleIn 0.15s
- Title: **「確認」**
- 兩個按鈕：「取消」(btn) + 「確認」(btn-primary)
- 點 overlay 背景 = 取消
- Promise-based API

#### Rating.svelte

> **來源**：`old-ref utils.js → createRating()`

- 5 顆星 ★/☆，hover scale(1.15)
- 點擊設定 1-5；**點擊同值 = 歸零 (rating=0)**
- `bind:value` 雙向繫結
- Props: `size` (預設 "1.25rem")

#### TagChips.svelte

- flex-wrap, gap 0.25rem
- 每個 chip 顯示 tag 名稱 + × 移除按鈕
- `.chip-removable` hover → 紅框 + 紅字

#### TagAutocomplete.svelte

> **來源**：`old-ref utils.js → createAutocomplete()`
> **⚠ 最複雜的共用元件，必須完整重現**

**Props**：
- `allTags: TagInfo[]` — 所有可選標籤（含 count）
- `excludedTags: string[]` — 已選中的標籤（排除）
- `placeholder: string`

**Events**：
- `select(tag: string)` — 使用者選了一個標籤
- `commit()` — 使用者在空 input 按 Enter
- `backspace()` — 使用者在空 input 按 Backspace

**Dropdown 外觀**：
- Fixed position, z-index 9999
- max-height 14rem, overflow-y auto
- bg-card, border, 陰影 `0 4px 16px rgba(0,0,0,0.45)`
- fadeIn 0.1s 動畫
- 每項：flex between, name + count (mono 字型)
- active 項 bg-hover
- **自動翻轉**：偵測空間不足時顯示在 input 上方

**鍵盤行為**：
| 按鍵 | 行為 |
|------|------|
| `ArrowDown` | highlight 下一項 |
| `ArrowUp` | highlight 上一項 |
| `Escape` | 隱藏 dropdown；再按一次 = blur input |
| `Enter` | 有 active 項 → 選取；input 有值無 active → 選取文字；input 空 → `commit()` |
| `,` / `，`（全形） | 提取文字選取 |
| `Tab` | 選取 active 項（或第一個匹配項） |
| `Backspace`（input 為空） | 觸發 `backspace()` |

**關閉行為**：blur 後 150ms delay 隱藏（讓 mousedown 有時間觸發）

#### FilterBar.svelte

- Tags autocomplete + Rating filter + Sort select
- 用於 Browse (filter view) / Scroll / Compare

#### ImagePreview.svelte

> **來源**：tagger/editor 的 zoom/pan 實作

- **滾輪縮放**：deltaY → scale ±0.1*scale，範圍 0.2–10
- **拖曳平移**：mousedown(button 0) → mousemove → panX/Y；mouseup 結束
- **雙擊重設**：scale=1, panX=panY=0
- Transform: `translate(${panX}px, ${panY}px) scale(${scale})`
- Cursor: grab / grabbing

#### ImageCard.svelte

- 縮圖 + overlay metadata
- 用於 Scroll / Compare 的卡片

#### Alert.svelte

- 三種類型：info / error / default（warning）
- 用於 Setup 頁面的 alert 提示

### 2.3 圖標

> **來源**：old-ref 使用 Tabler Icons CDN (`unpkg.com/@tabler/icons`)

新版方案：安裝 `@tabler/icons-svelte`（或手動嵌入 SVG），保持圖標一致。
必須支援的圖標列表：
`tag`, `pencil`, `player-play`, `layout-list`, `arrows-left-right`, `arrow-left`,
`chevron-right`, `check`, `trash`, `rotate`, `search`, `device-floppy`, `x`,
`clipboard`, `tool`, `file-search`, `file-alert`, `database`, `trash-x`,
`filter`, `arrows-shuffle`, `player-pause`, `arrow-up`, `settings`

### 2.4 更新 Setup 頁面

將 `setup/+page.svelte` 的 inline 樣式替換為全域 CSS + Alert.svelte 元件。

---

## 五、Phase 3 — 頁面實作

### ⚠ 通用規範（適用所有頁面）

1. **必先閱讀對應 old-ref** 的 `index.html` + `app.js` + `style.css`
2. **Toast 訊息文字**必須與 old-ref 一致（中文）
3. **空狀態**提示文字必須與 old-ref 一致
4. **動畫** fadeIn / slideUp / scaleIn 必須保留
5. **不需要 WebSocket**——老版所有 WS 相關行為統一移除（離線 overlay、自動重連、WS 訊息處理）。衝突由 `expectedUpdatedAt` 處理
6. **API response 取值**按 `{ ok, data: { ... } }` 格式取

---

### 3.0 首頁 `/` ⭐ 最先完成

> **對標**：`old-ref/public/index.html`

#### 佈局

- `.home-container` max-width 640px, 垂直居中 (min-height 100vh, flex-col, justify-center)
- 整體 `.slide-up` 動畫進場

#### 導航卡片（5 張）

| 名稱 | 路徑 | Icon | 描述 |
|------|------|------|------|
| Tagger | `/tagger` | `tag` icon | 審查並標記新圖片 |
| Editor | `/editor` | `pencil` icon | 編輯已儲存圖片 |
| Browse | `/browse` | `player-play` icon | 水平輪播瀏覽 |
| Scroll | `/scroll` | `layout-list` icon | 垂直捲動瀏覽 |
| Compare | `/compare` | `arrows-left-right` icon | 隨機比較 |

卡片樣式：`.home-card` flex, bg-card, border, radius*1.5, hover → bg-hover + border-hover。
每張卡片含 icon(24px) + 名稱&描述 + chevron-right(20px)。

#### 底部統計

- 格式：**「共 {totalImages} 張圖片 · {totalTags} 個標籤 · {stagedCount} 張待審查」**
- 載入中：skeleton placeholder 200px × 1rem
- 失敗：**「無法載入統計資訊」**
- API：`GET /api/stats`（或直接用 `+page.server.ts` SSR load）

#### SSR 實作

- `+page.server.ts` 已回傳 `stats` — 直接用 SSR data
- 首頁底部增加 **「⚙ 設定」** 連結 → `/setup`

---

### 3.1 Setup `/setup`（已有骨架，Phase 2 美化）

> **說明**：Phase 1 setup 已能正常運作。Phase 2 改用 Alert.svelte + 全域CSS即可。

---

### 3.2 Tagger `/tagger` ⭐ 最複雜

> **對標**：`old-ref/public/tagger/index.html` + `app.js` + `style.css`

#### 三欄佈局

```
┌──────────── Header (fixed top, 3rem) ─────────────┐
│ [← 首頁]     5/20 (15 剩餘) ████░░░     [🔧 工具] │
├─────────┬──────────────────────────┬──────────────┤
│ Sidebar │       Preview            │  Tag Panel   │
│ (220px) │   (zoom/pan image)       │   (280px)    │
│ thumb   │                          │  rating      │
│ thumb   │                          │  tag chips   │
│ thumb   │                          │  tag input   │
│         │                          │  buttons     │
│         │                          │  shortcuts   │
├─────────┴──────────────────────────┴──────────────┤
│              (preview info bar)                     │
└────────────────────────────────────────────────────┘
```

#### Header

- 左：「← 首頁」btn-ghost (arrow-left)
- 中：progress bar + 文字 **「{done}/{total} ({remaining} 剩餘)」**
  - `totalInitial` = 初始 staged 數量（僅記錄一次）
  - 百分比 = `Math.round(done / total * 100)`
- 右：「🔧 工具」按鈕

#### Sidebar

- Header：**「待審查」** + badge 數量
- 列表：`.tagger-thumb` 縮圖 (60px height, max 80px width)
  - active → bg-active + 白色左邊框 (3px)
  - committed → 綠色左邊框 (#22c55e)
  - trashed → 紅色左邊框 + opacity 0.5
- 名稱：0.6875rem, text-muted, ellipsis
- Lazy load：IntersectionObserver, rootMargin 100px
- 空狀態：**「沒有待審查的圖片」** (.tagger-empty, text-dim, 置中)

#### Preview 區

- 使用 ImagePreview.svelte（zoom/pan）
- Info bar（底部）：顯示檔名
- 空狀態（全部處理完）：**「所有圖片皆已處理，沒有新圖片」**
- **圖片預載**：selectImage 後自動 `new Image().src` 預載下一張

#### Tag Panel（右側面板）

1. Rating widget (1.5rem 星)
2. Separator
3. Tags list (flex-wrap, max-height 12rem, overflow-y auto) — 每個 chip 可移除
4. Tag input (placeholder **「輸入標籤...」**) — TagAutocomplete
5. Separator
6. Action buttons (flex-wrap)：
   - 「複製上一張」(clipboard icon)
   - **「提交」**(check icon, btn-primary)
   - **「刪除」**(trash icon, btn-destructive)
7. Separator
8. Keyboard shortcuts 顯示：
   - `←` `→` 切換圖片
   - `1`-`5` 評等
   - `T` 聚焦標籤
   - `C` 複製標籤
   - `Enter` 提交

#### 鍵盤快捷鍵

| 快捷鍵 | 功能 | 條件 |
|--------|------|------|
| `Ctrl+Z` | 復原 (undo) | 全域（含 input） |
| `←` ArrowLeft | 上一張圖片 | 非 input |
| `→` ArrowRight | 下一張圖片 | 非 input |
| `1`-`5` | 設定評等 | 非 input |
| `0` | 清除評等 | 非 input |
| `T`/`t` | 聚焦 tag input | 非 input |
| `C`/`c` | 複製上一張標籤 | 非 input |
| `Enter` | 提交當前 | 非 input |
| `Escape` | 關閉工具 modal | 非 input |
| `Delete` | 移至垃圾桶 | 非 input |

#### Toast 訊息（完整列表）

| 訊息 | 類型 | 觸發時機 |
|------|------|----------|
| 「無法載入待審查檔案」 | error | fetchStaged 失敗 |
| 「載入失敗: {message}」 | error | fetchStaged catch |
| 「標籤已存在」 | info | 添加重複 tag |
| 「請至少加入一個標籤才能提交」 | error | commit 時無 tag |
| 「提交失敗: {error}」 | error | commit API 回錯 |
| 「已提交: {filename}」 | success | commit 成功 |
| 「刪除失敗: {error}」 | error | trash API 回錯 |
| 「已移至垃圾桶: {filename}」 | info | trash 成功 |
| 「沒有上一張的標籤可以複製」 | info | 無 previousTags |
| 「已複製 {n} 個標籤」 | success | 複製標籤成功 |
| 「沒有可以復原的操作」 | info | undo stack 空 |
| 「提交復原需要重新載入頁面」 | info | undo commit |
| 「已從垃圾桶復原需要手動操作」 | info | undo trash |

#### Confirm 對話框

- 刪除前：**「確定要將「{filename}」移至垃圾桶？」**

#### Commit 流程

1. 驗證 tags 非空（否則 toast error）
2. 取得圖片寬高（`naturalWidth` / `naturalHeight`）
3. `POST /api/staged/commit` body: `{ filename, tags, rating, width, height }`
4. 記錄 `previousTags`（給「複製上一張」用）
5. 標記 sidebar 為 committed 狀態（綠色邊框）
6. 推入 undo stack
7. 自動選取下一張

#### Undo Stack

- 操作類型：`commit` / `trash`
- `Ctrl+Z` 彈出最後一項，根據類型：
  - commit → toast 提示需 reload
  - trash → toast 提示需手動操作

#### 工具 Modal

| 按鈕 | Icon | 操作 | 結果顯示 |
|------|------|------|----------|
| 檢查孤立檔案 | file-search | `GET /api/maintenance/orphans` | 「✓ 沒有找到孤立檔案」或「找到 N 個孤立檔案:\n • file1\n • file2」 |
| 檢查缺失檔案 | file-alert | `GET /api/maintenance/missing` | 「✓ 沒有找到缺失檔案」或「找到 N 個缺失記錄:\n • id — filename」 |
| 標籤重命名 | tag | `POST /api/tags/rename` body `{oldName, newName}` | prompt 輸入；「✓ 已將「{old}」重命名為「{new}」，影響 N 張圖片」 |
| 資料庫備份 | database | `POST /api/maintenance/backup` | 「✓ 備份完成: {backupPath}」 |
| 清空垃圾桶 | trash-x (btn-destructive) | `DELETE /api/trash` | confirm **「確定要清空垃圾桶？此操作無法復原。」** → 「✓ 已清空垃圾桶，刪除 N 個檔案」 |

- 操作中 loading 文字：「檢查中...」「重命名中...」「備份中...」「清空中...」
- 錯誤：「錯誤: {error}」
- 「關閉」按鈕 + 點 overlay 也關閉

#### Responsive（≤768px）

- Sidebar：全寬, max-height 120px, 水平捲動
- Tag Panel：全寬, max-height 40vh, border-top
- Shortcuts hint：hidden

#### API 呼叫

| 時機 | API |
|------|-----|
| 初始化 | `GET /api/tags`, `GET /api/staged` |
| 提交圖片 | `POST /api/staged/commit` |
| 刪除圖片 | `POST /api/staged/trash` |

#### 實作注意事項

- Client-heavy：操作頻率高，不適合 form action。使用 `$lib/api.ts` client fetch
- `+page.server.ts` 提供初始 staged files + all tags
- 核心互動全在 `+page.svelte` 的 `onMount` + reactive state

---

### 3.3 Editor `/editor`

> **對標**：`old-ref/public/editor/index.html` + `app.js` + `style.css`

#### 兩個視圖

**Search View**（無 `?id` 參數時）：
- `.editor-search` 置中, padding-top 6rem
- 標題：**「搜尋圖片」**
- Input：placeholder **「輸入圖片 ID 或原始檔名...」**
- 搜尋：debounce 300ms, `GET /api/images?limit=200`, client 端 filter by id/originalName
- 結果 grid：`repeat(auto-fill, minmax(10rem, 1fr))`
- 每張卡片：1:1 縮圖 + name + id (mono)
- 空狀態：**「找不到符合的圖片」**
- 點擊卡片 → `/editor?id={id}`

**Edit View**（有 `?id` 參數時）：
- Mobile：上圖下資訊
- ≥768px：左圖右資訊面板 (20rem / 24rem)

#### Header

- 左：「返回」按鈕 (arrow-left)
- 中：標題（搜尋模式 = **「搜尋圖片」**，編輯模式 = originalName）
- 右按鈕：
  - 正常圖片 → 「儲存」(btn-primary, device-floppy) + 「移入垃圾桶」(btn-destructive, trash)
  - 已刪除圖片 → 「儲存」 + 「還原」(rotate icon)

#### Info Panel（Edit View）

1. Rating widget (1.5rem 星)
2. Tags list (chips) + TagAutocomplete input
3. Meta info grid：
   - ID, 原始檔名, 檔案名稱 (id+ext), 提交時間, 檔案大小
   - 若已刪除：+ 刪除時間

#### Auto-save

- 任何 rating 或 tag 變更 → debounce 800ms → `PATCH /api/images/{id}` body `{ tags, rating, expectedUpdatedAt }`
- 成功 → toast **「已儲存」** + 更新本地 `updatedAt`
- 409 → toast **「此圖片已被修改，請重新整理」**（不可 auto-overwrite）
- 儲存按鈕 = 強制立即存（取消 debounce timer 立刻送出）

#### 返回導航

- 有 referrer 同源 → `history.back()`
- 否則 → `/`

#### Toast 訊息

| 訊息 | 類型 |
|------|------|
| 「找不到圖片: {error}」 | error |
| 「載入圖片失敗」 | error |
| 「搜尋失敗」 | error |
| 「標籤已存在」 | info |
| 「已儲存」 | success |
| 「儲存失敗: {error}」 | error |
| 「確定要將此圖片移入垃圾桶嗎？」 | confirm dialog |
| 「已移入垃圾桶」 | success |
| 「操作失敗: {error}」 | error |
| 「已還原」 | success |
| 「還原失敗: {error}」 | error |

#### API 呼叫

| 時機 | API |
|------|-----|
| 搜尋 | `GET /api/images?limit=200&sort=committedAt&order=desc` |
| 載入 | `GET /api/images/{id}`, `GET /api/tags` |
| 存檔 | `PATCH /api/images/{id}` with `expectedUpdatedAt` |
| 垃圾桶 | `DELETE /api/images/{id}` |
| 還原 | `POST /api/images/{id}/restore` |

---

### 3.4 Scroll `/scroll`

> **對標**：`old-ref/public/scroll/index.html` + `app.js` + `style.css`

#### 佈局

- Header：fixed top 48px → 「← 首頁」+ **「垂直瀏覽」**
- Filter bar：sticky top 48px, z-index 90
  - Tag chips + autocomplete (placeholder **「添加標籤...」**)
  - Rating filter（click toggle, active 色 `#facc15` 金色）
  - Sort select：時間 / 評等 / 檔名
  - 搜尋按鈕 (btn-primary)
  - 計數：**「{n} 張結果」**
- Image container：flex-column, gap 0.5rem
- Loading：**「載入中...」**
- FAB：fixed bottom-right, 48×48 圓形白色，arrow-up icon

#### 圖片卡片

- 全寬, bg-card, border, radius
- Image: width 100%, object-fit contain, 黑底
- Info row: name (ellipsis 60%) + rating (★ 黃)
- **雙擊**：新分頁開 `/editor?id={id}`
- Lazy load：IntersectionObserver rootMargin "200px 0px"

#### 無限捲動

- throttle 150ms scroll handler
- 距底 < 200px → `GET /api/images?page={next}&limit=30&...`
- FAB：scrollTop > 300 時顯示，click → smooth scroll to top

#### Touch-friendly

- Input/btn min-height 44px
- Rating star min-width/height 44px

#### Toast

| 訊息 | 類型 |
|------|------|
| 「載入失敗：{message}」 | error |

---

### 3.5 Compare `/compare`

> **對標**：`old-ref/public/compare/index.html` + `app.js` + `style.css`

#### 佈局

- Header：fixed top 3rem
  - 左：「← 首頁」
  - 中：**「比較」**
  - 右：tag chips + autocomplete (width 160px, placeholder **「標籤篩選...」**) + rating + 計數 **「{n} 張」**
- Main：flex-row, gap 2px, 各 50%
  - `.compare-card` — image (object-fit contain) + info overlay (gradient 底部)
  - Info overlay: rating (read-only ★) + tag chips
  - Hover：outline 2px border-hover
  - **Click**：新分頁 `/editor?id={id}`
- Footer：fixed bottom, 置中
  - 「換一組」(btn-primary, arrows-shuffle icon + kbd "Space")

#### 鍵盤

| 快捷鍵 | 功能 |
|--------|------|
| `Space` | 換一組 |

#### 空狀態

- 隱藏卡片，`.compare-empty` 置中：**「篩選條件下的圖片不足兩張」** 或 **「載入失敗，請稍後再試」**

#### API

| 時機 | API |
|------|-----|
| 初始化 | `GET /api/tags`, `GET /api/random-pair` |
| 篩選/換組 | `GET /api/random-pair?tags=...&rating=...&ratingOp=gte` |
| 計數 | `GET /api/images?limit=1&page=1&tags=...&rating=...&ratingOp=gte` |

#### Responsive（≤640px）

- flex-column, 各卡 50% 高
- Header filter flex-wrap

---

### 3.6 Browse `/browse` ⭐ Client-heavy

> **對標**：`old-ref/public/browse/index.html` + `app.js` + `style.css`

#### Phase 1: Filter View

- `.browse-filter-box` max-width 480px, bg-card, border, padding 2rem
- 標題：**「水平瀏覽」**
- 欄位：
  1. 「標籤篩選」+ tag chips + autocomplete (placeholder **「添加標籤...」**)
  2. 「最低評等」+ rating widget
  3. 「排序」+ select：提交時間 / 評等 / 檔名 / 隨機
  4. 計數：**「共 {n} 張符合」** (debounce 200ms)
  5. 「開始瀏覽」(btn-primary, player-play icon, 全寬) — disabled 當 n=0
  6. 「返回首頁」(btn-ghost, 全寬)

#### Phase 2: Player View（100% client-side DOM）

- 全螢幕 fixed inset 0, 黑底 #000
- **Carousel**：
  - requestAnimationFrame loop
  - Speed: px/frame at 60fps, `scrollX += speed * (dt / 16.667)`
  - 虛擬化：只渲染 viewport ± 2000px 內的 img
  - 更新閾值：每滾 300px 重建可見圖片集
  - 圖片寬 = `viewportHeight * (width/height)`，fallback ratio=1
  - DOM 元素池化重用
  - 無限循環：scrollX >= stripWidth → scrollX -= stripWidth
- **Dock**：
  - fixed bottom, `rgba(0,0,0,0.85)` + backdrop-filter blur(8px)
  - 播放/暫停 (icon 切換)
  - Progress slider (range 0-1000) + 「N / total」
  - Speed slider (range 0.2-6, step 0.1, default 1.5)
  - 「篩選」按鈕 (filter)
  - Auto-hide：2500ms idle → translateY(100%) + opacity 0，mousemove 恢復

#### 互動

- **單擊 carousel**：togglePlay 播放/暫停（250ms timeout 防雙擊）
- **雙擊 carousel**：新分頁 `/editor?id={id}`
- **Progress drag**：seeking 模式
- **Speed slider**：即時調整
- **Resize**：重建 strip layout + 保留 scroll 比例

#### 鍵盤

| 快捷鍵 | 功能 |
|--------|------|
| `Space` | 播放/暫停 |
| `Escape` | 返回 filter view |

#### API

| 時機 | API |
|------|-----|
| 載入 tags | `GET /api/tags` |
| 即時計數 | `GET /api/images?limit=1&page=1&...` |
| 開始播放 | 多頁 `GET /api/images?page=N&limit=200&...` 直到全部載完 |

#### 實作注意

Browse player 的 DOM 操作不適合放入 Svelte reactive system。
建議在 `onMount` 裡直接操作 DOM（像原本的 IIFE 一樣）。Svelte 只管 filter phase 的 reactivity。

---

## 六、Phase 4 — 收尾

### 4.1 驗證清單

- [ ] 所有 20 個 API 端點功能正常
- [ ] 衝突模擬：開兩分頁同時編輯同一張 → 後者收到 409
- [ ] Setup redirect guard：刪除 server.json → 重導 `/setup?alert=default`
- [ ] DB migration：舊 db.json 無 `updatedAt` → 自動 backfill
- [ ] Staged 為空時的 empty state
- [ ] 圖片被外部刪除時的 graceful handling
- [ ] 切換 collection：flush 舊 → load 新 → redirect `/`

### 4.2 效能驗證

- Browse player：1000+ 張圖要流暢（虛擬化 + 池化）
- Scroll：infinite scroll 不卡（IntersectionObserver + throttle）
- Tagger：commit 後切換下一張 < 200ms 體感

### 4.3 文件更新

- 更新 `docs_report1.md`（或新建 report2.md）記錄 Phase 2-4 完成內容

---

## 七、頁面互動強度

| 頁面 | SSR | Client | 說明 |
|------|-----|--------|------|
| `/setup` | ● | ○ 表單 | 純表單頁面 |
| `/` | ● | ○ | 靜態展示 + 設定連結 |
| `/scroll` | ◐ | ◐ | 首頁 SSR，後續 client fetch |
| `/compare` | ◐ | ◐ | Tags SSR，配對 client fetch |
| `/editor` | ◐ | ● | 圖片 SSR load，編輯全 client |
| `/tagger` | ◐ | ● | Staged list SSR，核心操作全 client |
| `/browse` | ◐ | ● | 篩選 SSR，播放器 100% client DOM |

---

## 八、頁面導航流

```
Index (/)
  ├→ /tagger        Tagger
  ├→ /editor        Editor (search view)
  ├→ /browse        Browse (filter view)
  ├→ /scroll        Scroll
  ├→ /compare       Compare
  └→ /setup         Settings (footer)

Tagger → / (Header ← 首頁)
Tagger → 工具 modal (internal)

Editor (search) → /editor?id={id} (click card)
Editor (edit) → / or history.back() (← 返回)

Browse filter → Browse player (internal switch)
Browse player → Browse filter (篩選 btn)
Browse player → /editor?id={id} (dblclick, new tab)

Scroll → / (Header ← 首頁)
Scroll → /editor?id={id} (dblclick, new tab)

Compare → / (Header ← 首頁)
Compare → /editor?id={id} (click card, new tab)
```

---

## 九、開發順序建議

```
Phase 2:  全域 CSS + 共用元件 + Setup 美化
Phase 3.0: 首頁（最簡單，smoke test）
Phase 3.4: Scroll（中等複雜度）
Phase 3.5: Compare（中等複雜度）
Phase 3.3: Editor（auto-save + conflict）
Phase 3.2: Tagger（最複雜）
Phase 3.6: Browse（最 client-heavy）
Phase 4:  收尾驗證
```

---

## 十、給後續 AI Agent 的強制規範

### 規範 A：實作前必先閱讀 old-ref

每個頁面必須 **逐行閱讀** `old-ref/public/<頁面>/app.js` + `index.html` + `style.css`。
色彩、間距、字型、按鈕位置、操作順序、提示訊息文字（中文），**全部與 old-ref 一致**。

### 規範 B：API response 格式

新版 `{ ok, data: { ... } }`。取資料時：
- `GET /api/staged` → `res.data.files`
- `GET /api/tags` → `res.data.tags`
- `GET /api/random-pair` → `res.data.pair`
- `GET /api/trash` → `res.data.items`
- `GET /api/maintenance/orphans` → `res.data.orphans`
- `GET /api/maintenance/missing` → `res.data.missing`

### 規範 C：tags/rename 欄位

Body 必須使用 `{ oldName, newName }`，**不可使用** `{ from, to }`。

### 規範 D：PATCH 必帶 expectedUpdatedAt

Editor 的每次 `PATCH /api/images/{id}` 都必須帶 `expectedUpdatedAt`。
收到 200 → 更新本地 `updatedAt`。
收到 409 → toast **「此圖片已被修改，請重新整理」**。

### 規範 E：commit 至少一個 tag

`POST /api/staged/commit` 空 tags → 400。前端應先擋。

### 規範 F：不需要 WebSocket

所有 old-ref 中的 WS 行為一律刪除。離線 overlay、自動重連、WS broadcast 全部不實作。

### 規範 G：db.ts 只管資料

**絕對不要**把 `fs.renameSync`, `fs.unlinkSync`, `fs.readdirSync` 之類的呼叫放進 `db.ts`。
所有檔案系統操作都在 route 裡完成。
