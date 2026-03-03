# Image Manager — SvelteKit 遷移計畫

## 〇、現狀分析

### 現有架構

- **後端**：原生 Node.js HTTP server + 手寫 router + 手寫 WebSocket
- **前端**：5 個 MPA 子系統（tagger / editor / browse / scroll / compare），以 vanilla JS IIFE 建構
- **資料層**：JSON 檔案型 in-memory DB，搭配 tag/rating index、dirty flag + 500ms 延遲寫入
- **依賴**：0 npm

### 現有問題

1. **手寫 router / WS / body parser** — 重造輪子、邊界情況多、維護成本高
2. **前端無元件抽象** — `createElement` 命令式 DOM 操作，每個子系統重複大量 UI pattern（tag chips、rating、autocomplete、modal、toast）
3. **Race condition 風險** — commit/trash 操作無 lock；WS broadcast 與 REST 回傳之間無一致性保證
4. **無 TypeScript** — 資料結構全靠口頭約定，refactor 危險
5. **WS 過度設計** — 單人本地工具引入了連線生命週期、心跳、重連、overlay 等複雜性

### 保留的核心概念

- `db.json` 作為唯一持久化來源（in-memory + flush），**放在圖片集根目錄中**
- 圖片生命週期：staged → committed → trash
- Tag / Rating index 加速查詢
- 圖片以 16-char hex ID 命名
- MPA 子系統各自獨立
- 支援多個圖片集（collection），透過 `server.json` 切換

---

## 一、技術方向（依據 draft.md 決策）

| 決策 | 說明 |
|------|------|
| **SvelteKit 全端** | SSR + MPA，node adapter |
| **移除 WebSocket** | 不實作即時同步；衝突在提交時以 version/updatedAt 驗證 |
| **不建立全域 client store** | Server = single source of truth；每次 page load = projection |
| **TypeScript** | 全面採用 TS |
| **最小依賴** | svelte + @sveltejs/kit + typescript + @types/node，不引入 ORM / UI lib / validation lib |
| **衝突處理** | 提交時比對 `updatedAt`，衝突回傳 409，UI 提示手動 reload |

---

## 二、遷移階段

### Phase 0：專案初始化 ✅ 目錄已建立

> **現狀（2026-03-03）**：
> - 新專案目錄已建立於 OneDrive **以外**：`C:\Users\Summe\Documents\Projects\image-manager`
> - 舊專案原始碼已保存至 `old-ref/`（僅供參考，不進入新建構）
> - 尚未執行 `npm create svelte@latest`，詳細初始化步驟見 `init.md`

待完成步驟：

1. ~~建立新專案目錄（OneDrive 以外）~~ ✅
2. `npm create svelte@latest .` → Skeleton project, TypeScript（在現有目錄內執行）
3. 安裝並設定 `@sveltejs/adapter-node`
4. tsconfig 設定 `strict: true`
5. **不使用 `.env`**；改用 `server.json`（machine-scope 設定檔，置於專案根目錄）
6. `server.json` 若不存在，程式啟動時自動建立空檔 `{}`
7. `.gitignore` 加入 `server.json`、`old-ref/`

### Phase 1：Server 核心模組

目標：完成所有 server-side 邏輯，可用 API 測試驗證。

#### 1.1 Config 模組 → `src/lib/server/config.ts`

- **`server.json`**：machine-scope 設定，專案根目錄，格式：
  ```json
  {
    "collectionRoot": "C:/Users/xxx/OneDrive/圖片/tagged"
  }
  ```
- 若檔案不存在 → 建立 `{}`
- `getCollectionRoot()` 讀取 `server.json` → 回傳路徑或 `null`
- `setCollectionRoot(path)` 寫入 `server.json` → 觸發 DB reload
- `isCollectionValid(path)` 檢查路徑下是否有 `staged/`, `committed/`, `trash/` 三個子目錄（不存在則自動建立）；回傳 boolean
- `getCollectionPaths(root)` 從 root 衍生所有路徑：
  - `staged` = `root/staged`
  - `committed` = `root/committed`
  - `trash` = `root/trash`
  - `db` = `root/db.json`
- **不做 OneDrive 自動偵測**（使用者手動設定）
- 匯出常數：`IMG_EXTS`, `MIME_TYPES`

#### 1.2 DB 模組 → `src/lib/server/db.ts`

- 搬移現有 db.js 邏輯至 TS
- 在 image record 加入 `updatedAt` 欄位（衝突偵測用）
- **可切換設計**：DB 不再是 immutable singleton，而是提供：
  - `loadCollection(rootPath)` — flush 當前 DB → 從新路徑載入 → rebuild indexes
  - `isLoaded()` — 回傳是否已載入有效的 collection
  - `getCurrentRoot()` — 回傳當前 collection root 路徑（或 null）
- Dev HMR 保護：用 `globalThis.__db` 防止 hot reload 重複初始化
- **新增**：所有寫入操作回傳 `updatedAt`，所有更新操作接受 `expectedUpdatedAt` 參數
- `db.json` 位於 **collection root 內**（與 staged/committed/trash 同層），非專案目錄
- 匯出型別：`ImageRecord`, `TrashedImageRecord`, `ListOptions`, `ListResult`

#### 1.3 API Routes → `src/routes/api/...`

將現有 REST API 1:1 對映至 SvelteKit server routes：

| 現有端點 | SvelteKit route |
|---------|-----------------|
| `GET /api/images` | `src/routes/api/images/+server.ts` → GET |
| `GET /api/images/:id` | `src/routes/api/images/[id]/+server.ts` → GET |
| `PATCH /api/images/:id` | `src/routes/api/images/[id]/+server.ts` → PATCH |
| `DELETE /api/images/:id` | `src/routes/api/images/[id]/+server.ts` → DELETE |
| `POST /api/images/:id/restore` | `src/routes/api/images/[id]/restore/+server.ts` → POST |
| `GET /api/staged` | `src/routes/api/staged/+server.ts` → GET |
| `POST /api/staged/commit` | `src/routes/api/staged/commit/+server.ts` → POST |
| `POST /api/staged/trash` | `src/routes/api/staged/trash/+server.ts` → POST |
| `GET /api/tags` | `src/routes/api/tags/+server.ts` → GET |
| `POST /api/tags/rename` | `src/routes/api/tags/rename/+server.ts` → POST |
| `GET /api/random-pair` | `src/routes/api/random-pair/+server.ts` → GET |
| `GET /api/stats` | `src/routes/api/stats/+server.ts` → GET |
| `GET /api/maintenance/orphans` | `src/routes/api/maintenance/orphans/+server.ts` → GET |
| `GET /api/maintenance/missing` | `src/routes/api/maintenance/missing/+server.ts` → GET |
| `POST /api/maintenance/import-orphan` | `src/routes/api/maintenance/import-orphan/+server.ts` → POST |
| `POST /api/maintenance/remove-missing` | `src/routes/api/maintenance/remove-missing/+server.ts` → POST |
| `GET /api/trash` | `src/routes/api/trash/+server.ts` → GET |
| `DELETE /api/trash` | `src/routes/api/trash/+server.ts` → DELETE |
| `DELETE /api/trash/:id` | `src/routes/api/trash/[id]/+server.ts` → DELETE |
| `POST /api/maintenance/backup` | `src/routes/api/maintenance/backup/+server.ts` → POST |

所有寫入端點加入衝突檢查邏輯（比對 `updatedAt`，不合則回 409）。
所有 API route 在處理前檢查 `db.isLoaded()`，若未載入 → 回傳 503。

#### 1.4 圖片代理 → `src/routes/img/[area]/[file]/+server.ts`

- `[area]` = committed | staged | trash
- 路徑由 `config.getCollectionPaths()` 動態取得（非硬編碼）
- path traversal 防護
- MIME type 偵測
- Cache-Control：committed → `public, max-age=86400`；staged/trash → `no-cache`
- `fs.createReadStream` 串流回傳

#### 1.5 Setup API → `src/routes/api/setup/+server.ts`

- `GET` — 回傳當前 `server.json` 的 `collectionRoot`（或 null）
- `POST { collectionRoot }` — 驗證路徑 → 寫入 `server.json` → `db.loadCollection()` → 回傳成功/失敗
- 此端點**不受** hooks 的 redirect guard 影響（因為 setup 頁面需要它）

#### 1.6 Hooks — Redirect Guard → `src/hooks.server.ts`

每個 request 進入時：

1. 白名單跳過：`/setup`、`/api/setup`、靜態資源 → 不檢查
2. 讀取 `server.json` → 取得 `collectionRoot`
3. 若 `collectionRoot` 為空或 null → redirect `/setup?alert=default`
4. 若 `collectionRoot` 存在但 `isCollectionValid()` 失敗 → redirect `/setup?alert=error`
5. 若有效但 DB 尚未載入（首次 request 或切換後）→ `db.loadCollection(root)`
6. 正常繼續

```typescript
// hooks.server.ts 虛擬碼
export async function handle({ event, resolve }) {
  const { pathname } = event.url;

  // 白名單
  if (pathname.startsWith('/setup') || pathname.startsWith('/api/setup')) {
    return resolve(event);
  }

  const root = config.getCollectionRoot();
  if (!root) {
    throw redirect(303, '/setup?alert=default');
  }
  if (!config.isCollectionValid(root)) {
    throw redirect(303, '/setup?alert=error');
  }

  // 確保 DB 已載入當前 collection
  if (!db.isLoaded() || db.getCurrentRoot() !== root) {
    db.loadCollection(root);
  }

  return resolve(event);
}
```

### Phase 2：共用 UI 元件（Svelte Components）

目標：將現有 `shared/utils.js` + `shared/components.css` 拆解為 Svelte 元件。

#### 2.1 全域樣式

- `src/lib/styles/reset.css` — CSS reset + variables（從 `shared/style.css` 搬移）
- `src/lib/styles/components.css` — 基礎元件樣式（可逐步改為 component-scoped）

#### 2.2 Svelte 共用元件 → `src/lib/components/`

| 元件 | 來源 | 說明 |
|------|------|------|
| `Toast.svelte` | `utils.js → toast()` | Svelte store 驅動，自動淡出 |
| `ConfirmModal.svelte` | `utils.js → confirm()` | Promise-based，鍵盤支援 |
| `Rating.svelte` | `utils.js → createRating()` | ★☆ 互動式，`bind:value` 雙向繫結 |
| `TagChips.svelte` | tagger/browse 重複邏輯 | 標籤列表 + 移除按鈕 |
| `TagAutocomplete.svelte` | `utils.js → createAutocomplete()` | 最複雜的共用元件；輸入搜尋、ArrowKey 導航、Tab/Enter/逗號確認、Backspace 刪除上一個 |
| `ImageCard.svelte` | scroll/compare 卡片 | 縮圖 + metadata overlay |
| `FilterBar.svelte` | browse/scroll/compare 篩選列 | 標籤 + 評等 + 排序 |
| `Alert.svelte` | 新增全域元件 | 類型：`info` / `error` / `default`；用於 setup 頁面等場景的提示訊息 |

#### 2.3 共用 utility

- `src/lib/utils.ts` — `formatDate`, `formatSize`, `debounce`, `throttle`（純函式，非 DOM）
- `src/lib/api.ts` — 若有需要在 client 做 fetch 的場景（browse player 等 client-heavy 頁面）

### Phase 3：頁面實作

依照複雜度由低到高排序。每個頁面使用 SvelteKit 的 `+page.server.ts`（load function）作為 SSR 資料來源。

#### 3.0 Setup 頁面 `/setup` ⭐ 最先實作

- `+page.server.ts` — load 當前 `server.json` 的 `collectionRoot`
- `+page.svelte` — 設定表單（輸入圖片集根目錄路徑）
- **URL params 控制 alert 狀態**：
  - 無 param → 不顯示 alert（正常進入設定頁面，例如從首頁 footer 連結）
  - `?alert=default` → 顯示「尚未設定圖片集路徑」提示（首次使用或路徑為空時 redirect 附帶）
  - `?alert=error` → 顯示「資料夾結構異常或路徑無效」錯誤提示（路徑存在但驗證失敗時 redirect 附帶）
- Alert 位於表單正下方，使用共用 `Alert.svelte` 元件
- 送出表單 → `POST /api/setup` → 成功則 redirect 到 `/`
- **不受 hooks redirect guard 影響**（此路由 + `/api/setup` 為白名單）

#### 3.1 首頁 `/`

- `src/routes/+page.server.ts` — load stats
- `src/routes/+page.svelte` — 導航卡片 + 統計數字 + **footer 含「設定」連結至 `/setup`**
- 最簡單，作為 smoke test

#### 3.2 Scroll `/scroll`

- `+page.server.ts` — 初始載入第一頁圖片（SSR）+ 所有 tags
- `+page.svelte` — 垂直無限捲動
- Client 端：`IntersectionObserver` lazy load + scroll 偵測載入下一頁（fetch `/api/images?page=N`）
- 點擊圖片 → 開啟 editor

#### 3.3 Compare `/compare`

- `+page.server.ts` — 載入 tags
- `+page.svelte` — 呼叫 `/api/random-pair` 取得配對，Space/按鈕 shuffle
- 點擊 → 新分頁 editor

#### 3.4 Editor `/editor`

- 支援兩種模式：搜尋模式（無 `?id`）和編輯模式（有 `?id`）
- `+page.server.ts` — 若有 id 則 load image detail + tags；若無則 load tags only
- `+page.svelte` — 圖片預覽（zoom/pan）、rating、tag editing、trash/restore
- 儲存策略：debounce 800ms auto-save via `PATCH /api/images/:id`，附帶 `expectedUpdatedAt`
- 衝突時顯示 toast 提示 reload

#### 3.5 Tagger `/tagger` ⭐ 最複雜

- `+page.server.ts` — load staged files + all tags
- `+page.svelte` — 三欄佈局 + 大量 client 互動
- **保留 client-heavy 設計**：因為 tagger 需要快速連續操作（commit → 自動下一張 → 輸入 tag → commit），SSR 每次 re-render 會太慢
- Client 端操作流程：
  - Sidebar list（lazy loaded thumbnails）
  - Preview（zoom/pan）
  - Tag panel（autocomplete + chips + rating + commit/trash buttons）
  - 鍵盤快捷鍵（←→ 切換、1-5 評等、T 聚焦、C 複製、Enter 提交、Delete 刪除）
  - 「複製上一張標籤」功能
- API 呼叫全在 client 端（不經 form action），因為操作頻率高且需要即時反饋

#### 3.6 Browse `/browse` ⭐ Client-heavy

- **Phase 1（篩選）**：可以 SSR — load tags + matchCount
- **Phase 2（Player）**：純 client side
  - 水平連續捲動 carousel（requestAnimationFrame）
  - 虛擬渲染（只 render viewport ± buffer 範圍內的 img）
  - 無限循環（copy-based wrap）
  - Progress slider + speed slider
  - Dock auto-hide
  - 雙擊開啟 editor
- 這個頁面幾乎等同於 canvas 播放器，不適合 SSR，完整保留 client-side architecture
- Svelte 只負責 filter phase 的 reactivity；player phase 直接操作 DOM（效能考量）

### Phase 4：收尾

1. **移除 WebSocket 所有相關程式碼**（server ws.js、client ws module）
2. **驗證所有 API 端點**
3. **衝突模擬測試**（開兩個分頁，同時編輯同一張圖片）
4. **Edge case 處理**：
   - db.json 不存在時自動建立（在 collection root 中）
   - `server.json` 不存在或為空時 → redirect `/setup?alert=default`
   - `server.json` 指向的路徑無效/毀損 → redirect `/setup?alert=error`
   - staged 資料夾為空時的 empty state
   - 圖片檔案被外部程序刪除時的 graceful handling
   - 切換 collection 時：flush 舊 DB → load 新 DB → redirect `/`
5. **DB migration**：現有 `db.json` 需追加 `updatedAt` 欄位（寫一個 one-time migration：遍歷所有 images，`updatedAt = committedAt`）

---

## 三、頁面互動強度分類

| 頁面 | SSR 程度 | Client 程度 | 說明 |
|------|----------|-------------|------|
| `/setup` | ● 完全 SSR | ○ 表單送出 | 設定頁面，form submit |
| `/` | ● 完全 SSR | ○ 無 | 純展示 + footer 設定連結 |
| `/scroll` | ◐ 初始 SSR | ◐ Infinite scroll | 首頁 SSR，後續 client fetch |
| `/compare` | ◐ 初始 SSR | ◐ Random pair | Tags SSR，配對 client fetch |
| `/editor` | ◐ 初始 SSR | ● 編輯操作 | 圖片資料 SSR，所有編輯 client-side |
| `/tagger` | ◐ 初始 SSR | ● 高頻操作 | Staged list SSR，核心操作全 client |
| `/browse` | ◐ Filter SSR | ● Player 全 client | 篩選 SSR，播放器 100% client DOM |

---

## 四、衝突處理策略（詳細）

```
Client 載入圖片 → 記住 updatedAt=T1
Client 修改 tags, rating → PATCH { tags, rating, expectedUpdatedAt: T1 }
Server 檢查：
  if (record.updatedAt !== expectedUpdatedAt)
    → 409 Conflict { currentData: {...}, updatedAt: record.updatedAt }
  else
    → record.updatedAt = Date.now(), 儲存, 回傳 200 { updatedAt: newT }
Client 收到 200 → 更新本地 updatedAt
Client 收到 409 → Toast "此圖片已被修改，請重新整理"
```

此策略足夠應對「多分頁同時編輯」的情境。

---

## 五、資料模型定義（TypeScript）

```typescript
interface ImageRecord {
  ext: string;                // '.png', '.jpg', ...
  originalName: string;       // 原始檔名
  tags: string[];             // 標籤列表
  rating: number;             // 0-5
  committedAt: number;        // Unix ms
  updatedAt: number;          // Unix ms（新增）
  fileSize: number;           // bytes
  width: number;              // px, 0 = unknown
  height: number;             // px, 0 = unknown
}

interface TrashedImageRecord extends ImageRecord {
  trashedAt: number;          // Unix ms
}

interface DB {
  version: number;
  images: Record<string, ImageRecord>;
  trashedImages: Record<string, TrashedImageRecord>;
}

// server.json (machine-scope，專案根目錄)
interface ServerConfig {
  collectionRoot?: string;    // 圖片集根目錄絕對路徑，null 表示尚未設定
}
```

### 圖片集目錄結構

一個有效的 collection root 目錄應包含：

```
<collectionRoot>/          # e.g. C:/Users/xxx/OneDrive/圖片/tagged
├── staged/                # 待審查圖片
├── committed/             # 已提交圖片 (以 hex ID 命名)
├── trash/                 # 垃圾桶
└── db.json                # 該圖片集的資料庫
```

使用者可以有多個這樣的目錄（不同主題、不同用途），透過 `/setup` 切換。
```

---

## 六、開發順序建議

```
Week 1: Phase 0 + Phase 1 (Server core)
         - 專案建立、server.json / config、db.ts（含 switchable 設計）
         - 所有 API routes + Setup API + 圖片代理
         - 用 curl / Thunder Client 驗證每個端點

Week 2: Phase 2 (共用元件) + Setup 頁面
         - 全域 CSS、Toast、Modal、Rating、TagAutocomplete、Alert
         - /setup 頁面（含 redirect guard）—— 最先完成的前端頁面

Week 3: Phase 3.1-3.3 (簡單頁面)
         - 首頁（含 footer 設定連結）、Scroll、Compare

Week 4: Phase 3.4-3.5 (複雜頁面)
         - Editor、Tagger

Week 5: Phase 3.6 + Phase 4 (Browse + 收尾)
         - Browse player（最 client-heavy 的部分）
         - 最終測試、edge case、migration、collection 切換測試
```

---

## 七、注意事項

1. **SvelteKit dev 模式 HMR**：DB module 必須用 `globalThis` guard，否則 hot reload 會重新初始化 in-memory 狀態
2. **圖片快取**：committed 圖片 ID 不變（immutable）→ `Cache-Control: public, max-age=86400` 是安全的
3. **Browse player 的 DOM 操作**：這段邏輯不適合 Svelte reactive system，建議在 Svelte `onMount` 裡直接操作 canvas/DOM，類似現有的 IIFE 架構
4. **Tagger 的操作頻率**：commit 後自動切換下一張 → 不適合 form action（太慢），維持 client `fetch` + 手動更新 reactive state
5. **db.json 放在圖片集根目錄**：確保 flush 操作是原子的（write tmp → rename），避免 OneDrive 同步到半寫狀態
6. **不要引入不必要的 client store**：大部分頁面用 `+page.server.ts` load data → props 即可，不需要 Svelte store
7. **圖片路徑安全**：所有圖片代理路徑必須做 `path.resolve` + `startsWith(baseDir)` 驗證
8. **server.json 與 db.json 的區別**：`server.json` 是 machine-scope（專案根目錄，不同步）；`db.json` 是 collection-scope（在圖片集內，隨 OneDrive 同步）
9. **Collection 切換**：切換時必須先 `flush()` 當前 DB，再 `loadCollection()` 新路徑；hooks.server.ts 中的 redirect guard 需在每次 request 檢查 config 有效性
10. **多圖片集未來擴展**：`server.json` 目前只存 `collectionRoot`，未來可擴展為 `collections: [{ name, root }]` + `activeCollection` 欄位，但 Phase 1 不需要

---

## 八、給後續 AI Agent 的強制規範（Phase 2+ 必讀）

### ⚠ 規範 A：實作前必先閱讀 old-ref

**每個頁面的實作，必須先閱讀 `old-ref/public/<頁面名>/app.js` 和對應的 HTML/CSS。** 不可僅依賴 docs 描述。

具體要求：
- **樣式 & 布局**：色彩、間距、字型、元件排列方式，必須與 old-ref 一致或有明確理由改動
- **使用者流程（UX flow）**：按鈕位置、操作順序、提示訊息文字（中文），必須與 old-ref 一致
- **鍵盤快捷鍵**：tagger 的 `←→` 切換、`1-5` 評等、`T` 聚焦、`C` 複製、`Enter` 提交、`Delete` 刪除，必須完整保留
- **Toast 訊息文字**：保留原文（例如：「請至少加入一個標籤才能提交」、「已提交: {filename}」）
- **Empty state**：每個頁面的空狀態提示必須與 old-ref 一致

### ⚠ 規範 B：API response format 已改變，不可使用舊格式

新版所有 API 回傳格式為 `{ ok: boolean, data: {...} }` 或 `{ ok: false, error: "..." }`。
舊版各 endpoint 直接回傳 `res.data = array` 或物件；**新版資料一律在 `res.data` 的子鍵中**：

| Endpoint | 舊版 `res.data` | 新版 `res.data` 的子鍵 |
|----------|-----------------|---------------------|
| `GET /api/staged` | `string[]`（陣列） | `{ files: string[] }` → 取 `res.data.files` |
| `GET /api/tags` | `TagInfo[]`（陣列） | `{ tags: TagInfo[] }` → 取 `res.data.tags` |
| `GET /api/random-pair` | `[ImageWithId, ImageWithId]` | `{ pair: [ImageWithId, ImageWithId] }` → 取 `res.data.pair` |
| `GET /api/trash` | `TrashedImageWithId[]` | `{ items: TrashedImageWithId[] }` → 取 `res.data.items` |
| `GET /api/maintenance/orphans` | `string[]` | `{ orphans: string[] }` → 取 `res.data.orphans` |
| `GET /api/maintenance/missing` | `string[]` | `{ missing: string[] }` → 取 `res.data.missing` |
| `DELETE /api/trash` | `{ deleted: number }` | `{ deleted: number }` → 取 `res.data.deleted` |
| `POST /api/maintenance/backup` | `{ path: "db.backup.xxx.json" }` | `{ backupPath: "/full/path/..." }` → 取 `res.data.backupPath` |

### ⚠ 規範 C：部分 API 欄位名已變更

| Endpoint | 舊版請求欄位 | 新版請求欄位 |
|----------|------------|------------|
| `POST /api/tags/rename` | `{ from, to }` | `{ oldName, newName }` |

**Tagger 頁面**的 tools modal 呼叫 rename 時，必須使用 `{ oldName, newName }`，**不可使用** `{ from, to }`。

### ⚠ 規範 D：Editor 的 PATCH 必須帶 expectedUpdatedAt

舊版 editor `saveChanges()` 直接 `PATCH { tags, rating }`（無衝突偵測）。
**新版 `PATCH /api/images/:id` 必須帶 `expectedUpdatedAt: number`**，否則回傳 400。

Editor 實作規範：
- 載入圖片時記住 `currentImage.updatedAt`
- 每次 PATCH 帶 `expectedUpdatedAt: currentImage.updatedAt`
- 收到 200 後更新 `currentImage.updatedAt = res.data.updatedAt`
- 收到 409 時顯示 toast「此圖片已被修改，請重新整理」（不可 auto-overwrite）

### ⚠ 規範 E：commit 限制與已移除端點

- `POST /api/staged/commit` **至少需要一個 tag**，空陣列回傳 400
- `POST /api/staged/commit-batch` 端點**已刪除**（確認為死代碼，從未被任何前端調用）
- `GET /api/random-pair` 支援 `?tags=xxx,yyy&rating=3&ratingOp=gte` 等篩選參數（與 old-ref 行為一致）

### ⚠ 規範 F：old-ref 的部分行為已刻意改動

| 行為 | old-ref | 新版（刻意改動） |
|------|---------|----------------|
| staged trash 的檔名 | 保留原始檔名移至 trash/ | 加前綴 `staged_{timestamp}_` 避免與 committed 的 ID 衝突 |
| tags/rename 欄位 | `from`, `to` | `oldName`, `newName`（避免 `from` 保留字混淆） |
| backup 回傳路徑 | `{ path: "db.backup.xxx.json" }` 僅 basename | `{ backupPath: "/full/path/..." }` 完整路徑 |
