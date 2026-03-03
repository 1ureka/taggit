# Image Manager — SvelteKit 專案結構

```
image-manager/
│
├── server.json                          # Machine-scope 設定 (自動建立, 不進 git)
│                                        # { "collectionRoot": "C:/…/tagged" }
├── svelte.config.js                      # SvelteKit config (adapter-node)
├── vite.config.ts                        # Vite config
├── tsconfig.json
├── package.json
├── .gitignore                            # 含 server.json
│
├── src/
│   │
│   ├── app.html                      # HTML shell template
│   ├── app.css                       # 全域 CSS (reset + variables)
│   │
│   ├── lib/
│   │   │
│   │   ├── types.ts                  # 共用型別定義
│   │   │                               # ImageRecord, TrashedImageRecord, DB,
│   │   │                               # ListOptions, ListResult, TagInfo, Stats,
│   │   │                               # ServerConfig
│   │   │
│   │   ├── utils.ts                  # 純函式工具
│   │   │                               # formatDate, formatSize, debounce, throttle
│   │   │
│   │   ├── api.ts                    # Client-side fetch wrapper (給 client-heavy 頁面用)
│   │   │                               # get, post, patch, del
│   │   │
│   │   ├── server/                   # ⚠ 僅 server 端可 import
│   │   │   │
│   │   │   ├── config.ts            # server.json 讀寫 + collection 路徑管理
│   │   │   │                           # getCollectionRoot(), setCollectionRoot()
│   │   │   │                           # isCollectionValid(), getCollectionPaths()
│   │   │   │                           # ensureServerJson() (不存在則建立 {})
│   │   │   │                           # IMG_EXTS, MIME_TYPES
│   │   │   │                           # ⛔ 不做 OneDrive 自動偵測
│   │   │   │
│   │   │   ├── db.ts                # 核心 DB 模組 (in-memory + JSON flush)
│   │   │   │                           # globalThis.__db guard (HMR safe)
│   │   │   │                           # ★ 可切換設計:
│   │   │   │                           #   loadCollection(rootPath) — flush→load→rebuild
│   │   │   │                           #   isLoaded() — 是否已載入有效 collection
│   │   │   │                           #   getCurrentRoot() — 當前 collection root
│   │   │   │                           # Tag index (Map<string, Set<string>>)
│   │   │   │                           # Rating index (Map<number, Set<string>>)
│   │   │   │                           # CRUD: getImage, listImages, commitImage,
│   │   │   │                           #        updateTags, updateRating,
│   │   │   │                           #        trashImage, restoreImage
│   │   │   │                           # Tag ops: getAllTags, renameTag
│   │   │   │                           # Trash: getTrash, emptyTrash, deleteTrashedImage
│   │   │   │                           # Maintenance: findOrphans, findMissing,
│   │   │   │                           #              importOrphan, removeMissing
│   │   │   │                           # Stats: getStats
│   │   │   │                           # Persistence: markDirty, flush, load
│   │   │   │                           # Conflict: 所有寫入操作含 updatedAt 比對
│   │   │   │                           # db.json 位於 collectionRoot/ 內 (非專案目錄)
│   │   │   │
│   │   │   └── validation.ts        # 輸入驗證函式
│   │   │                               # isValidId, isValidTags, isValidRating,
│   │   │                               # isValidFilename
│   │   │
│   │   └── components/              # Svelte 共用元件
│   │       │
│   │       ├── Toast.svelte          # Toast 通知 (store-driven, 自動消失)
│   │       ├── ConfirmModal.svelte   # 確認對話框 (Promise-based)
│   │       ├── Rating.svelte         # ★☆ 星級評等 (bind:value)
│   │       ├── TagChips.svelte       # 標籤列表 (chips + remove button)
│   │       ├── TagAutocomplete.svelte # 標籤輸入自動完成
│   │       │                           # props: allTags, excludedTags
│   │       │                           # events: select, commit, backspace
│   │       │                           # 支援: ArrowKey, Tab, Enter, 逗號, Backspace
│   │       ├── FilterBar.svelte      # 篩選列 (tags + rating + sort)
│   │       ├── ImageCard.svelte      # 圖片卡片 (縮圖 + overlay info)
│   │       └── ImagePreview.svelte   # 可縮放/平移的圖片預覽
│   │                                   # wheel zoom + drag pan + dblclick reset
│   │
│   ├── routes/
│   │   │
│   │   ├── +layout.svelte           # 根 layout (匯入 app.css, Toast 元件)
│   │   ├── +layout.server.ts        # (空或最小化，不做全域載入)
│   │   │
│   │   ├── +page.server.ts          # 首頁 load: stats
│   │   ├── +page.svelte             # 首頁: 導航卡片 + 統計 + footer 含「設定」連結→/setup
│   │   │
│   │   ├── setup/
│   │   │   ├── +page.server.ts      # load: 當前 collectionRoot (from server.json)
│   │   │   └── +page.svelte         # 設定頁面: 圖片集路徑表單
│   │   │                              # URL params: ?alert=default | ?alert=error | 無
│   │   │                              # Alert 位於表單正下方 (Alert.svelte)
│   │   │                              # POST /api/setup → 成功則 redirect /
│   │   │                              # ⛔ 不受 hooks redirect guard 影響
│   │   │
│   │   ├── tagger/
│   │   │   ├── +page.server.ts      # load: staged files + all tags
│   │   │   └── +page.svelte         # 三欄佈局: sidebar + preview + tag panel
│   │   │                              # Client-heavy: 快捷鍵, 連續操作, zoom/pan
│   │   │                              # 使用 $lib/api.ts 做 client-side fetch
│   │   │
│   │   ├── editor/
│   │   │   ├── +page.server.ts      # load: image detail (if ?id) + all tags
│   │   │   └── +page.svelte         # 搜尋模式 / 編輯模式
│   │   │                              # zoom/pan preview, debounce auto-save
│   │   │                              # 衝突偵測 (409 → toast)
│   │   │
│   │   ├── browse/
│   │   │   ├── +page.server.ts      # load: all tags (for filter phase)
│   │   │   └── +page.svelte         # Phase 1: SSR filter form
│   │   │                              # Phase 2: Client-only carousel player
│   │   │                              # requestAnimationFrame + 虛擬渲染
│   │   │                              # DOM 直接操作 (onMount)
│   │   │
│   │   ├── scroll/
│   │   │   ├── +page.server.ts      # load: first page images + all tags
│   │   │   └── +page.svelte         # 垂直無限捲動
│   │   │                              # IntersectionObserver lazy load
│   │   │                              # client fetch next pages
│   │   │
│   │   ├── compare/
│   │   │   ├── +page.server.ts      # load: all tags
│   │   │   └── +page.svelte         # 隨機配對比較
│   │   │                              # client fetch /api/random-pair
│   │   │
│   │   ├── img/
│   │   │   └── [area]/              # area = committed | staged | trash
│   │   │       └── [file]/
│   │   │           └── +server.ts   # 圖片代理路由
│   │   │                              # 路徑由 config.getCollectionPaths() 動態取得
│   │   │                              # path traversal 防護
│   │   │                              # MIME + Cache-Control
│   │   │                              # fs.createReadStream
│   │   │
│   │   └── api/
│   │       ├── setup/
│   │       │   └── +server.ts        # GET: 當前 collectionRoot
│   │       │                           # POST: 設定新 collectionRoot → 驗證 → 寫入
│   │       │                           #        server.json → db.loadCollection()
│   │       │                           # ⛔ 不受 hooks redirect guard 影響
│   │       │
│   │       ├── images/
│   │       │   ├── +server.ts        # GET: listImages (query params)
│   │       │   └── [id]/
│   │       │       ├── +server.ts    # GET: getImage
│   │       │       │                   # PATCH: updateTags/Rating + conflict check
│   │       │       │                   # DELETE: trashImage
│   │       │       └── restore/
│   │       │           └── +server.ts # POST: restoreImage
│   │       │
│   │       ├── staged/
│   │       │   ├── +server.ts        # GET: list staged files
│   │       │   ├── commit/
│   │       │   │   └── +server.ts    # POST: commit single
│   │       │   ├── commit-batch/
│   │       │   │   └── +server.ts    # POST: commit batch
│   │       │   └── trash/
│   │       │       └── +server.ts    # POST: trash staged file
│   │       │
│   │       ├── tags/
│   │       │   ├── +server.ts        # GET: getAllTags
│   │       │   └── rename/
│   │       │       └── +server.ts    # POST: renameTag
│   │       │
│   │       ├── random-pair/
│   │       │   └── +server.ts        # GET: random pair
│   │       │
│   │       ├── stats/
│   │       │   └── +server.ts        # GET: stats
│   │       │
│   │       ├── trash/
│   │       │   ├── +server.ts        # GET: list trash | DELETE: empty trash
│   │       │   └── [id]/
│   │       │       └── +server.ts    # DELETE: single trash item
│   │       │
│   │       └── maintenance/
│   │           ├── orphans/
│   │           │   └── +server.ts    # GET: find orphans
│   │           ├── missing/
│   │           │   └── +server.ts    # GET: find missing
│   │           ├── import-orphan/
│   │           │   └── +server.ts    # POST: import orphan
│   │           ├── remove-missing/
│   │           │   └── +server.ts    # POST: remove missing
│   │           └── backup/
│   │               └── +server.ts    # POST: backup db
│   │
│   └── hooks.server.ts              # Server hooks
│                                       # - Redirect guard:
│                                       #   白名單: /setup, /api/setup, 靜態資源
│                                       #   無 collectionRoot → redirect /setup?alert=default
│                                       #   路徑無效/毀損 → redirect /setup?alert=error
│                                       #   有效但 DB 未載入 → db.loadCollection()
│                                       # - Graceful shutdown (SIGINT → flush)
│
├── static/                           # 靜態資源 (favicon 等)
│
└── <collectionRoot>/                 # ⚠ 在 OneDrive 內 (非專案目錄)
    ├── staged/                       # 待審查圖片
    ├── committed/                    # 已提交圖片 (hex ID 命名)
    ├── trash/                        # 垃圾桶
    └── db.json                       # 該圖片集的資料庫
```

---

## 檔案對映：舊 → 新

| 舊檔案 | 新位置 | 備註 |
|--------|--------|------|
| `index.js` | `hooks.server.ts` | 啟動邏輯 → redirect guard + DB 載入 |
| `lib/config.js` | `src/lib/server/config.ts` | 移除 OneDrive 偵測；改用 server.json 讀寫 |
| `lib/db.js` | `src/lib/server/db.ts` | 加入 updatedAt + conflict check + switchable |
| `lib/router.js` | ❌ 移除 | SvelteKit file-based routing 取代 |
| `lib/server.js` | ❌ 移除 | SvelteKit adapter-node 取代 |
| `lib/ws.js` | ❌ 移除 | 不再使用 WebSocket |
| `lib/api/images.js` | `src/routes/api/images/...` | 拆分為多個 +server.ts |
| `lib/api/tags.js` | `src/routes/api/tags/...` | 拆分為 +server.ts |
| `lib/api/maintenance.js` | `src/routes/api/maintenance/...` + `api/trash/...` | 拆分 |
| — (新增) | `src/routes/api/setup/+server.ts` | server.json 設定 API |
| — (新增) | `src/routes/setup/+page.svelte` | 設定頁面 (含 Alert) |
| `public/shared/utils.js` | `src/lib/utils.ts` + `src/lib/api.ts` + `src/lib/components/*.svelte` | 拆解 |
| `public/shared/style.css` | `src/app.css` | 全域樣式 |
| `public/shared/components.css` | 各 `*.svelte` component scoped styles | 元件化 |
| `public/index.html` | `src/routes/+page.svelte` | SSR + footer 設定連結 |
| `public/tagger/*` | `src/routes/tagger/+page.svelte` | Svelte 元件化 |
| `public/editor/*` | `src/routes/editor/+page.svelte` | Svelte 元件化 |
| `public/browse/*` | `src/routes/browse/+page.svelte` | 混合 SSR + client |
| `public/scroll/*` | `src/routes/scroll/+page.svelte` | 混合 SSR + client |
| `public/compare/*` | `src/routes/compare/+page.svelte` | 混合 SSR + client |
| `data/db.json` | `<collectionRoot>/db.json` | 移至圖片集根目錄內 |

---

## 型別定義概覽 (`src/lib/types.ts`)

```typescript
// ─── Image Record ────────────────────────────────────────
export interface ImageRecord {
  ext: string;
  originalName: string;
  tags: string[];
  rating: number;
  committedAt: number;
  updatedAt: number;
  fileSize: number;
  width: number;
  height: number;
}

export interface TrashedImageRecord extends ImageRecord {
  trashedAt: number;
}

export interface ImageWithId extends ImageRecord {
  id: string;
}

export interface TrashedImageWithId extends TrashedImageRecord {
  id: string;
}

// ─── Server Config ───────────────────────────────────────
export interface ServerConfig {
  collectionRoot?: string;  // 圖片集根目錄絕對路徑，undefined = 尚未設定
}

// ─── Collection Paths (從 collectionRoot 衍生) ───────────
export interface CollectionPaths {
  root: string;
  staged: string;
  committed: string;
  trash: string;
  db: string;
}

// ─── DB ──────────────────────────────────────────────────
export interface DB {
  version: number;
  images: Record<string, ImageRecord>;
  trashedImages: Record<string, TrashedImageRecord>;
}

// ─── Query ───────────────────────────────────────────────
export interface ListOptions {
  tags?: string[];
  rating?: number;
  ratingOp?: 'gte' | 'lte' | 'eq';
  sort?: 'committedAt' | 'rating' | 'originalName';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ListResult {
  items: ImageWithId[];
  total: number;
  page: number;
  pages: number;
}

// ─── Tag ─────────────────────────────────────────────────
export interface TagInfo {
  name: string;
  count: number;
}

// ─── Stats ───────────────────────────────────────────────
export interface Stats {
  totalImages: number;
  totalTags: number;
  stagedCount: number;
  trashCount: number;
}

// ─── API Response ────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
```
