# 重構計畫：伺服器端 guard 與載入機制統一化

## 目標

以型別安全的 `requireDatabase` / `requirePaths` 取代散落各處的 `guardLoaded` + `getDB` + `getPaths` 組合，消除所有 `!` non-null assertion；同時將 hooks 白名單 redirect 移至 layout load，讓頁面層與 API 層各自以最合理的方式處理「集合未載入」情境：頁面 redirect、API 回 503 JSON。

### 架構變更：guard + getDB/paths → requireDatabase/requirePaths

消除所有 `!` non-null assertion，以型別安全的 helper 取代現行的「先 guard 再取值」兩段式慣用法。

| 舊 API | 問題 | 新 API |
|---|---|---|
| `guardLoaded()` + `getPaths()` | `getPaths()` 內部 `getCurrentRoot()!` 需要斷言 | `requirePaths(): CollectionPaths \| null` |
| `guardLoaded()` + `getDB()` + `getPaths()` | 呼叫端需兩段式 guard + 斷言 | `requireDatabase(): { db, paths } \| null` |
| `getDB()` 直接使用（page.server.ts） | 隱含 loaded 假設 | `requireDatabase()` |

### 架構變更：hooks 白名單制 → layout load + API 自判

現行 `hooks.server.ts` 以白名單攔截所有請求，負責 redirect 到 `/settings`。此架構有以下問題：

| 問題 | 說明 |
|---|---|
| 無法傳型別 | hooks 無法將 db/paths 傳入 page load，`event.locals` 是弱型別擴充 |
| 白名單維護成本 | 每新增路由或靜態資源路徑（`/_app/`、`/favicon`）都要手動加入 |
| API 語意不正確 | 外部直接呼叫 API 時收到 303 redirect 到 `/settings` 不合理，應回 503 JSON |
| 效能浪費 | 每個請求（含靜態資源）都過 `isWhitelisted` 判斷 |

**改為**：

- **頁面 redirect**：新增 `+layout.server.ts`，在 layout load 中檢查 DB 狀態，未載入時 `throw redirect(303, "/settings")`。只在頁面導覽時執行，靜態資源零開銷。
- **API guard**：各 route 用 `requireDatabase` / `requirePaths` 自行回 503 JSON。
- **hooks 精簡**：僅保留 SIGINT/SIGTERM flush 與自動 `loadCollection`（確保首次請求時 DB ready），移除 redirect 邏輯與白名單。

---

### 新 helper 簽名（定義在 `src/lib/server/helpers.ts`）

```ts
/**
 * 若集合已知路徑，回傳 CollectionPaths；否則回傳 null。
 * 已知路徑不代表集合已載入 (DB 可能尚未載入或載入失敗)
 */
export function requirePaths(): CollectionPaths | null {
  const db = getDB();
  const root = db.getCurrentRoot();
  if (!root) return null;
  return getCollectionPaths(root);
}

/**
 * 若集合已載入，回傳 { db, paths } bundle；否則回傳 null。
 * 呼叫端需自行回傳 503。
 */
export function requireDatabase(): { db: JSONDatabase; paths: CollectionPaths } | null {
  const db = getDB();
  if (!db.isLoaded()) return null;
  const paths = requirePaths();
  if (!paths) return null;
  return { db, paths };
}
```

#### 設計重點

- **`requirePaths`** 只檢查 `getCurrentRoot()`，不檢查 `isLoaded()`。語意：「我們知道集合在哪」。
  適用於只需要路徑就能做事的場景（列檔案、提供圖片）。
- **`requireDatabase`** 檢查 `isLoaded()` 後一次回傳 db + paths bundle。語意：「DB 已準備好，可以查詢/寫入」。
  大多數 API route 只需要這一個 null check 就能同時拿到 db 和 paths，零 `!`。

### 呼叫端慣用法（API route）

**多數情境（需要 db + paths）— 一次 null check，零 `!`：**

```ts
const loaded = requireDatabase();
if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
const { db, paths } = loaded;
```

**只需 paths（如 trash/staged 列檔、img endpoint）：**

```ts
const paths = requirePaths();
if (!paths) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
```

**只需 db（如 stats 查詢）— 解構忽略 paths：**

```ts
const loaded = requireDatabase();
if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
const { db } = loaded;
```

---

## 受影響檔案清單

### A 類：API routes — 使用 `guardLoaded` + `getPaths` + `getDB`

| # | 檔案 | guardLoaded | getPaths | getDB | 說明 |
|---|---|---|---|---|---|
| A1 | `routes/api/images/[id]/+server.ts` | 3 | 1 | 4 | GET/PATCH/DELETE |
| A2 | `routes/api/metadata/+server.ts` | 2 | 1 | 2 | POST 補算 / GET 檢查 |
| A3 | `routes/api/staged/[filename]/+server.ts` | 2 | 2 | 2 | POST 入庫 / DELETE 退回 |
| A4 | `routes/api/maintenance/orphans/+server.ts` | 2 | 2 | 2 | GET/DELETE 孤兒檔 |
| A5 | `routes/api/maintenance/missing/+server.ts` | 2 | 2 | 3 | GET/DELETE 缺檔 |
| A6 | `routes/api/maintenance/backup/+server.ts` | 1 | 1 | 1 | GET 備份 |

### B 類：API routes — 使用 `guardLoaded` + `getPaths`（無直接 `getDB`）

| # | 檔案 | guardLoaded | getPaths | 說明 |
|---|---|---|---|---|
| B1 | `routes/api/trash/+server.ts` | 3 | 2 | GET/POST/DELETE |
| B2 | `routes/api/trash/[filename]/+server.ts` | 2 | 2 | POST/DELETE |
| B3 | `routes/api/staged/+server.ts` | 2 | 1 | GET/POST |

### C 類：API routes — 使用 `guardLoaded` + `getDB`（無 `getPaths`）

| # | 檔案 | guardLoaded | getDB | 說明 |
|---|---|---|---|---|
| C1 | `routes/api/images/+server.ts` | 1 | 1 | GET |
| C2 | `routes/api/metadata/tags/+server.ts` | 2 | 2 | GET/PATCH |
| C3 | `routes/api/metadata/stats/+server.ts` | 1 | 1 | GET |

### D 類：圖片 endpoint — 直接使用 `getDB().isLoaded()` + `getPaths`

| # | 檔案 | 說明 |
|---|---|---|
| E1 | `routes/img/[area]/[file]/+server.ts` | 回傳純文字 503，非 JSON |

### F 類：Page server load — 僅使用 `getDB()`

| # | 檔案 | getDB | 說明 |
|---|---|---|---|
| F1 | `routes/+page.server.ts` | 1 | 首頁統計 |
| F2 | `routes/browse/+page.server.ts` | 1 | 瀏覽頁 |
| F3 | `routes/browse/player/+page.server.ts` | 1 | 播放器 |
| F4 | `routes/compare/+page.server.ts` | 1 | 比較頁 |
| F5 | `routes/scroll/+page.server.ts` | 1 | 無限捲動 |
| F6 | `routes/editor/+page.server.ts` | 1 | 編輯器列表 |

### G 類：不遷移

| # | 檔案 | 原因 |
|---|---|---|
| G1 | `routes/api/maintenance/setup/+server.ts` | 此 endpoint 的職責是初始化 collection，呼叫 `getDB().loadCollection(root)`，不應做 loaded 檢查 |
| G2 | `hooks.server.ts` | 精簡為生命週期管理（flush + auto loadCollection），移除 redirect 白名單邏輯（見 Phase 6） |
| G3 | `lib/server/helpers.ts` | 新 helper 的定義處；舊 helper 最終刪除 |
| G4 | `routes/api/maintenance/cache/+server.ts` | `getCacheStats` / `clearCache` 純操作記憶體 LRU cache，與 DB、paths 完全無關。移除 `guardLoaded` 即可，不需替換為新 helper |

---

## 漸進式遷移步驟

### Phase 0：新增 helper（不動任何呼叫端）

**變更檔案**：`src/lib/server/helpers.ts`

1. 新增 `requirePaths()` 與 `requireDatabase()` 兩個函式（如上方簽名）。
2. 新增 `import { type JSONDatabase }` 以便在回傳型別中使用。
3. **保留** `guardLoaded()` 和 `getPaths()` 不動。
4. 確認建置通過。

---

### Phase 1：移除 cache 路由的 guard（G4）

**目標**：`routes/api/maintenance/cache/+server.ts`

**改法**：直接刪除 `guardLoaded` 呼叫及其 import。`getCacheStats` / `clearCache` 純操作記憶體 LRU cache，不依賴 DB 或 paths。

```ts
// 前
import { guardLoaded } from "$lib/server/helpers.js";

export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: getCacheStats() });
};

// 後
export const GET: RequestHandler = () => {
  return json({ ok: true, data: getCacheStats() });
};
```

---

### Phase 2：遷移 C 類（guardLoaded + getDB）

**目標**：C1、C2、C3

**改法**（以 C1 `api/images/+server.ts` 為例）：

```ts
// 前
const err = guardLoaded();
if (err) return err;
return json({ ok: true, data: queryImages(getDB(), parseQueryParams(url)) });

// 後
const loaded = requireDatabase();
if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
return json({ ok: true, data: queryImages(loaded.db, parseQueryParams(url)) });
```

> 只需要 db 時可直接 `loaded.db`，或解構 `const { db } = loaded`。

此階段完成後，所有 `guardLoaded` + `getDB` 組合都已被 `requireDatabase` 取代。

---

### Phase 3：遷移 B 類（guardLoaded + getPaths）

**目標**：B1、B2、B3

> B 類只需要 paths 不需要 db，使用 `requirePaths` 而非 `requireDatabase`。

**改法**（以 B1 `api/trash/+server.ts` 的 POST handler 為例）：

```ts
// 前
const err = guardLoaded();
if (err) return err;
const paths = getPaths();

// 後
const paths = requirePaths();
if (!paths) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
```

不需要 `!`，`paths` 在 if 之後已 narrowed 為 `CollectionPaths`。

---

### Phase 4：遷移 A 類（guardLoaded + getPaths + getDB）

**目標**：A1–A6

**改法**（以 A1 `api/images/[id]/+server.ts` 的 DELETE handler 為例）：

```ts
// 前
const err = guardLoaded();
if (err) return err;
const image = getImage(getDB(), id);
// ...
const paths = getPaths();

// 後
const loaded = requireDatabase();
if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
const { db, paths } = loaded;
const image = getImage(db, id);
```

> `requireDatabase()` 的 bundle 回傳讓 A 類從「兩次 null check」降為**一次**，零 `!`。這是此設計最大的贏面。

---

### Phase 5：遷移 D 類（img endpoint）

**目標**：D1 `routes/img/[area]/[file]/+server.ts`

**改法**：

```ts
// 前
if (!getDB().isLoaded()) {
  return new Response("No collection loaded", { status: 503 });
}
const paths = getPaths();

// 後
const paths = requirePaths();
if (!paths) {
  return new Response("No collection loaded", { status: 503 });
}
```

注意此 endpoint 回傳純文字 503 而非 JSON，遷移時保留此行為。

---

### Phase 6：hooks → layout load 重構 + F 類遷移

此 Phase 將 hooks 的 redirect 邏輯移至 layout load，同時遷移 F 類 page.server.ts。

#### 6a. 新增 `src/routes/+layout.server.ts`

```ts
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";
import { requireDatabase } from "$lib/server/helpers.js";

export const load: LayoutServerLoad = ({ url }) => {
  // /settings 本身不需要 DB
  if (url.pathname.startsWith("/settings")) return {};

  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=default");

  return { collectionRoot: loaded.paths.root };
};
```

> layout load 的回傳值自動流入 `$page.data`，子路由可直接取用且型別完整。
> 靜態資源（`/_app/`、`/favicon`）不經過 layout load，無需白名單。

#### 6b. 精簡 `hooks.server.ts`

移除 `isWhitelisted` 函式與整個 redirect guard 區塊。保留：
- SIGINT/SIGTERM flush
- `ensureServerJson()`
- 自動 `loadCollection`（確保首次請求時 DB ready）

```ts
// 精簡後的 handle
export const handle: Handle = async ({ event, resolve }) => {
  const jsonDB = getDB();
  if (!jsonDB.isLoaded()) {
    const root = config.getCollectionRoot();
    if (root && config.isCollectionValid(root)) {
      jsonDB.loadCollection(root);
    }
  }
  return resolve(event);
};
```

> hooks 不再做 redirect，只做「如果有 valid root 就自動載入」的最小工作。

#### 6c. 遷移 F 類（page.server.ts）

**目標**：F1–F6

由於 layout load 已保證非 `/settings` 頁面的 DB 一定 loaded，F 類的 `getDB()` 可安全替換為 `requireDatabase()`。如果 layout redirect 已生效，這些 load 函式不會被執行。

**改法**（以 F1 `routes/+page.server.ts` 為例）：

```ts
// 前
const db = getDB();
return { stats: { totalImages: getImageCount(db), … } };

// 後
const loaded = requireDatabase();
if (!loaded) return { stats: { totalImages: 0, totalTags: 0, stagedCount: 0, trashCount: 0 } };
const { db } = loaded;
return { stats: { totalImages: getImageCount(db), … } };
```

> `if (!loaded)` 是防禦性寫法 — 正常流程下 layout load 已 redirect，此分支不會被觸發。
> 但它消除了型別上的 null 可能性，不需要 `!`。

---

### Phase 7：遷移 helpers.ts 內部使用

**目標**：`getStagedFiles()` 和 `getTrashFiles()` 內部呼叫 `getPaths()`

**改法**：

```ts
// 前
export function getStagedFiles(): string[] {
  try {
    const staged = getPaths().staged;
    // …
  } catch { return []; }
}

// 後
export function getStagedFiles(): string[] {
  const paths = requirePaths();
  if (!paths) return [];
  try {
    return fs.readdirSync(paths.staged)
      .filter(…)
      .sort(…);
  } catch { return []; }
}
```

---

### Phase 8：清除舊 API

1. 從 `src/lib/server/helpers.ts` 刪除 `guardLoaded()` 和 `getPaths()`。
2. 從 `hooks.server.ts` 移除 `isWhitelisted` 與舊 redirect 邏輯（若 6b 尚未做）。
3. 全專案搜尋確認 `guardLoaded`、`getPaths` 無殘留引用。
4. 移除相關 import。
5. 確認建置通過、測試通過。

---

## 遷移檢查清單

- [x] Phase 0：新增 `requirePaths` + `requireDatabase`
- [x] Phase 1：移除 cache 路由的 guard（G4）
- [ ] Phase 2：C 類（images, tags, stats）
- [ ] Phase 3：B 類（trash, staged）
- [ ] Phase 4：A 類（images/[id], metadata, staged/[filename], orphans, missing, backup）
- [ ] Phase 5：D 類（img endpoint）
- [ ] Phase 6a：新增 `+layout.server.ts`（redirect 邏輯）
- [ ] Phase 6b：精簡 `hooks.server.ts`（移除白名單 redirect）
- [ ] Phase 6c：F 類（page.server.ts ×6）
- [ ] Phase 7：helpers.ts 內部
- [ ] Phase 8：刪除 `guardLoaded` + `getPaths` + 清除殘留
- [ ] 最終建置驗證
