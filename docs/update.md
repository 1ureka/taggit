# 重構計畫：以 `requirePaths` / `requireDatabase` 取代 `guardLoaded` / `getPaths` / `getDB`

## 目標

消除所有 `!` non-null assertion，以型別安全的 helper 取代現行的「先 guard 再取值」兩段式慣用法。

| 舊 API | 問題 | 新 API |
|---|---|---|
| `guardLoaded()` + `getPaths()` | `getPaths()` 內部 `getCurrentRoot()!` 需要斷言 | `requirePaths(): CollectionPaths \| null` |
| `guardLoaded()` + `getDB()` + `getPaths()` | 呼叫端需兩段式 guard + 斷言 | `requireDatabase(): { db, paths } \| null` |
| `getDB()` 直接使用（page.server.ts） | 隱含 loaded 假設 | `requireDatabase()` |

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

### D 類：API routes — 僅使用 `guardLoaded`

| # | 檔案 | guardLoaded | 說明 |
|---|---|---|---|
| D1 | `routes/api/maintenance/cache/+server.ts` | 2 | GET/DELETE |

### E 類：圖片 endpoint — 直接使用 `getDB().isLoaded()` + `getPaths`

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
| G2 | `hooks.server.ts` | hooks 層自動載入 collection，使用 `getDB()` 做生命週期管理，不適用 require pattern |
| G3 | `lib/server/helpers.ts` | 新 helper 的定義處；舊 helper 最終刪除 |

---

## 漸進式遷移步驟

### Phase 0：新增 helper（不動任何呼叫端）

**變更檔案**：`src/lib/server/helpers.ts`

1. 新增 `requirePaths()` 與 `requireDatabase()` 兩個函式（如上方簽名）。
2. 新增 `import { type JSONDatabase }` 以便在回傳型別中使用。
3. **保留** `guardLoaded()` 和 `getPaths()` 不動。
4. 確認建置通過。

---

### Phase 1：遷移 D 類（僅 guardLoaded，最簡單）

**目標**：`routes/api/maintenance/cache/+server.ts`（D1）

**改法**：

```ts
// 前
const err = guardLoaded();
if (err) return err;

// 後
const loaded = requireDatabase();
if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
```

> D1 不使用 db/paths，但 `requireDatabase` 兼具 guard 作用。解構可省略。

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

### Phase 5：遷移 E 類（img endpoint）

**目標**：E1 `routes/img/[area]/[file]/+server.ts`

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

### Phase 6：遷移 F 類（page.server.ts 的 getDB）

**目標**：F1–F6

**改法**（以 F1 `routes/+page.server.ts` 為例）：

```ts
// 前
const db = getDB();
return { stats: { totalImages: getImageCount(db), … } };

// 後
const loaded = requireDatabase();
return {
  stats: {
    totalImages: loaded ? getImageCount(loaded.db) : 0,
    // …
  },
};
```

> Page load 不能回傳 Response（SvelteKit 限制），通常用「回傳空值」處理 not loaded 情境。
> 或者在 layout load 中統一 redirect 到設定頁，視目前的 UX 決策而定。
> 如果 hooks.server.ts 已保證頁面請求時 DB 一定 loaded，F 類可保持 `getDB()`（因為 hooks 做了保護），但仍建議遷移以統一風格。

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
2. 全專案搜尋確認無殘留引用。
3. 移除相關 import。
4. 確認建置通過、測試通過。

---

## 遷移檢查清單

- [ ] Phase 0：新增 `requirePaths` + `requireDatabase`
- [ ] Phase 1：D 類（cache）
- [ ] Phase 2：C 類（images, tags, stats）
- [ ] Phase 3：B 類（trash, staged）
- [ ] Phase 4：A 類（images/[id], metadata, staged/[filename], orphans, missing, backup）
- [ ] Phase 5：E 類（img endpoint）
- [ ] Phase 6：F 類（page.server.ts ×6）
- [ ] Phase 7：helpers.ts 內部
- [ ] Phase 8：刪除 `guardLoaded` + `getPaths`
- [ ] 最終建置驗證
