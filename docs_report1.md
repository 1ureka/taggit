# Image Manager — Phase 0 & Phase 1 完成報告

> **撰寫者**：AI Agent（2026-03-03）
> **接手前必讀**：`docs_init.md`、`docs_plan.md`、`docs_structure.md`，再看本文件。

---

## 一、本次完成的工作

### Phase 0 — 確認完成

| 項目 | 狀態 | 說明 |
|------|------|------|
| SvelteKit + TypeScript + adapter-node | ✅ | 已於 init.md 所述步驟完成（`npx sv create .`） |
| `tsconfig.json` `strict: true` | ✅ | 已確認在 compilerOptions 中 |
| `.gitignore` 含 `server.json`、`old-ref` | ✅ | 已確認在 `.gitignore` 中 |
| 清除無用檔案（README、robots.txt 等） | ✅ | 檔案不存在，表示已清除 |

### Phase 1 — 新增的檔案

#### 型別與共用工具

| 檔案 | 說明 |
|------|------|
| `src/lib/types.ts` | 所有共用 TypeScript 型別：`ImageRecord`, `TrashedImageRecord`, `ImageWithId`, `TrashedImageWithId`, `ServerConfig`, `CollectionPaths`, `DBData`, `ListOptions`, `ListResult`, `TagInfo`, `Stats`, `ApiResponse` |
| `src/lib/utils.ts` | 純函式：`formatDate`, `formatSize`, `debounce`, `throttle` |
| `src/lib/api.ts` | Client-side fetch wrapper：`api.get / post / patch / del`，供 tagger、editor 等 client-heavy 頁面使用 |

#### Server 核心模組

| 檔案 | 說明 |
|------|------|
| `src/lib/server/config.ts` | `server.json` 讀寫。`ensureServerJson()`：不存在時自動建立 `{}`。`getCollectionRoot()`, `setCollectionRoot()`, `isCollectionValid()`（自動建立 staged/committed/trash 子目錄）, `getCollectionPaths()`, 匯出 `IMG_EXTS` / `MIME_TYPES` |
| `src/lib/server/db.ts` | 核心 DB 模組。`globalThis.__db` HMR guard。可切換設計：`loadCollection(root)`, `isLoaded()`, `getCurrentRoot()`。完整 CRUD：`getImage`, `listImages`, `commitImage`, `updateImage`（含衝突檢查：`expectedUpdatedAt` 不符時 throw `{ status: 409 }`）, `trashImage`, `restoreImage`。Tag ops：`getAllTags`, `renameTag`。Trash ops：`getTrash`, `emptyTrash`, `deleteTrashedImage`。Maintenance：`findOrphans`, `findMissing`, `importOrphan`, `removeMissing`, `backupDb`。Stats：`getStats`。Flush：`flush()`（原子寫入：tmp → rename）。Staged：`listStaged`, `trashStagedFile`。Random：`getRandomPair` |
| `src/lib/server/validation.ts` | `isValidId`（16-char hex）, `isValidTags`（string[]、無重複、無空字串）, `isValidRating`（integer 0-5）, `isValidFilename`（禁止路徑分隔符）, `isValidAbsPath` |

#### Hooks

| 檔案 | 說明 |
|------|------|
| `src/hooks.server.ts` | Redirect guard：白名單（/setup、/api/setup、/_app/、/favicon）→ 跳過；無 collectionRoot → 302 /setup?alert=default；路徑無效 → 302 /setup?alert=error；DB 未載入或 root 切換 → `db.loadCollection()`。啟動時呼叫 `ensureServerJson()`（關鍵：保證 server.json 存在且為 `{}`）。SIGINT/SIGTERM → `db.flush()` 後 exit（HMR-safe：`globalThis.__sigintRegistered` guard）。 |

#### API 路由（21 個端點）

| 路由 | 方法 | 說明 |
|------|------|------|
| `api/setup` | GET | 回傳當前 `collectionRoot`（或 null） |
| `api/setup` | POST | `{ collectionRoot }` → 驗證 → `setCollectionRoot` → `loadCollection` |
| `api/images` | GET | `listImages`，支援 query params：`tags`（逗號分隔）, `rating`, `ratingOp`, `sort`, `order`, `page`, `limit` |
| `api/images/[id]` | GET | `getImage` |
| `api/images/[id]` | PATCH | `{ tags?, rating?, expectedUpdatedAt }` → `updateImage`；衝突回傳 409 |
| `api/images/[id]` | DELETE | `trashImage` |
| `api/images/[id]/restore` | POST | `restoreImage` |
| `api/staged` | GET | `listStaged` |
| `api/staged/commit` | POST | `{ filename, tags, rating, width?, height? }` → `commitImage` |
| `api/staged/commit-batch` | POST | `{ files: CommitEntry[] }` → 批次 commit（先驗全部再執行） |
| `api/staged/trash` | POST | `{ filename }` → `trashStagedFile` |
| `api/tags` | GET | `getAllTags`（按 count desc） |
| `api/tags/rename` | POST | `{ oldName, newName }` → `renameTag` |
| `api/random-pair` | GET | `getRandomPair`（需 ≥2 張圖片） |
| `api/stats` | GET | `getStats` |
| `api/trash` | GET | `getTrash` |
| `api/trash` | DELETE | `emptyTrash` |
| `api/trash/[id]` | DELETE | `deleteTrashedImage` |
| `api/maintenance/orphans` | GET | `findOrphans` |
| `api/maintenance/missing` | GET | `findMissing` |
| `api/maintenance/import-orphan` | POST | `{ filename }` → `importOrphan` |
| `api/maintenance/remove-missing` | POST | `{ id }` → `removeMissing` |
| `api/maintenance/backup` | POST | `backupDb`（時間戳命名備份） |

#### 圖片代理

| 路由 | 說明 |
|------|------|
| `routes/img/[area]/[file]/+server.ts` | `[area]` 限制為 committed/staged/trash。path traversal 防護（`path.resolve` + startsWith 驗證）。MIME type 透過 `MIME_TYPES` 對映。Cache-Control：committed → `public, max-age=86400`；其他 → `no-cache`。以 `Readable.toWeb()` 串流回傳 |

#### 前端骨架（Phase 1 可運作的最小前端）

| 檔案 | 說明 |
|------|------|
| `routes/setup/+page.server.ts` | load：回傳當前 `collectionRoot` |
| `routes/setup/+page.svelte` | 設定表單，支援 `?alert=default` / `?alert=error` URL param；`POST /api/setup` → 成功則 redirect `/` |
| `routes/+page.server.ts` | load：`getStats()` |
| `routes/+page.svelte` | 4 格統計卡片 + 5 個主頁導覽連結 + footer 設定連結 |

---

## 二、關鍵設計決策（供下一個 Agent 參考）

### server.json 不預先建立（符合測試需求）
`ensureServerJson()` 在 `hooks.server.ts` module 初始化時以及 `readServerJson()` 中呼叫，**確保第一次 request 到達時才建立**。你啟動 server 時，若 `server.json` 不存在，它會在 process 啟動後第一次調用 hooks 時被自動建立為 `{}`，接著重導向至 `/setup?alert=default`。

### 衝突檢測（optimistic locking）
`PATCH /api/images/[id]` 必須帶 `expectedUpdatedAt`（數值）。若 `record.updatedAt !== expectedUpdatedAt`，`db.updateImage()` 會拋出帶 `status: 409` 屬性的 Error，API route 捕捉後回傳 409 + 當前 record。

### HMR 安全
`db.ts` 用 `globalThis.__db` guard；`hooks.server.ts` 用 `globalThis.__sigintRegistered` guard。兩者都在 dev HMR 時安全不重複執行。

### DB 位置
`db.json` 位於 `<collectionRoot>/db.json`（非專案目錄），由 `getCollectionPaths(root).db` 計算。

---

## 三、目前尚未完成的工作（給下一個 Agent）

### Phase 2 — 共用 UI 元件（下一個 Agent 應從這裡開始）

詳見 `docs_plan.md` Section Phase 2。需要建立：

1. **全域樣式**
   - `src/app.css` — reset + CSS variables（顏色、間距、字型）
   - 更新 `src/routes/+layout.svelte` 匯入 `app.css`

2. **Svelte 共用元件** → `src/lib/components/`
   - `Toast.svelte` — store-driven toast，自動淡出（`src/lib/stores/toast.ts` 搭配）
   - `ConfirmModal.svelte` — Promise-based 確認對話框，支援鍵盤
   - `Rating.svelte` — ★☆ 星級互動，`bind:value`
   - `TagChips.svelte` — 標籤列表 + 移除按鈕
   - `TagAutocomplete.svelte` — 輸入自動完成，含 ArrowKey/Tab/Enter/逗號/Backspace
   - `FilterBar.svelte` — tags + rating + sort 篩選列
   - `ImageCard.svelte` — 縮圖 + metadata overlay
   - `ImagePreview.svelte` — wheel zoom + drag pan + dblclick reset
   - `Alert.svelte` — info/error/default 三種型別（用於 setup 頁面）

3. **更新 setup 頁面**：目前 setup 頁面使用 inline 樣式，Phase 2 應改用 Alert.svelte 元件

### Phase 3 — 頁面實作

依 `docs_plan.md` 順序：Setup（完善）→ 首頁 → Scroll → Compare → Editor → Tagger → Browse

---

## 四、手動驗證指令（給使用者）

```powershell
# 1. 啟動開發伺服器
cd C:\Users\Summe\Documents\Projects\image-manager
npm run dev
```

開啟瀏覽器視窗後，應自動：
1. `server.json` 被建立為 `{}`（可用 `Get-Content server.json` 確認）
2. 瀏覽器重導向至 `http://localhost:5173/setup?alert=default`

---

```powershell
# 2. 確認 server.json 已自動建立（在另一個 terminal 或等待頁面載入後）
Get-Content .\server.json
# 預期輸出: {}
```

---

```powershell
# 3. 建立測試用圖片集目錄
$testRoot = "C:\Temp\test-collection"
New-Item -ItemType Directory -Force -Path $testRoot

# 確認子目錄不存在（setup API 應自動建立）
Get-ChildItem $testRoot
```

---

```powershell
# 4. 測試 Setup API — GET（應回傳 null）
Invoke-RestMethod -Uri "http://localhost:5173/api/setup" -Method GET | ConvertTo-Json
# 預期: { "ok": true, "data": { "collectionRoot": null } }
```

---

```powershell
# 5. 測試 Setup API — POST 設定圖片集路徑
$body = @{ collectionRoot = "C:\Temp\test-collection" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5173/api/setup" -Method POST `
  -ContentType "application/json" -Body $body | ConvertTo-Json
# 預期: { "ok": true, "data": { "collectionRoot": "C:\\Temp\\test-collection" } }

# 確認 server.json 已更新
Get-Content .\server.json

# 確認子目錄已自動建立
Get-ChildItem "C:\Temp\test-collection"
# 預期: staged/ committed/ trash/ 三個目錄
```

---

```powershell
# 6. 瀏覽器應可正常進入首頁
# 開啟 http://localhost:5173/ — 應看到統計卡片（全為 0）
```

---

```powershell
# 7. 測試 Stats API
Invoke-RestMethod -Uri "http://localhost:5173/api/stats" | ConvertTo-Json
# 預期: { ok: true, data: { totalImages: 0, totalTags: 0, stagedCount: 0, trashCount: 0 } }

# 8. 測試 Tags API
Invoke-RestMethod -Uri "http://localhost:5173/api/tags" | ConvertTo-Json
# 預期: { ok: true, data: { tags: [] } }

# 9. 測試 Images list API
Invoke-RestMethod -Uri "http://localhost:5173/api/images" | ConvertTo-Json
# 預期: { ok: true, data: { items: [], total: 0, page: 1, pages: 0 } }

# 10. 測試 Staged list API
Invoke-RestMethod -Uri "http://localhost:5173/api/staged" | ConvertTo-Json
# 預期: { ok: true, data: { files: [] } }
```

---

```powershell
# 11. 放一張圖片到 staged 目錄，測試 commit
#     (先複製任意一張 jpg 到 C:\Temp\test-collection\staged\test.jpg)
Copy-Item "任意圖片路徑.jpg" "C:\Temp\test-collection\staged\test.jpg"

# 確認 staged list 有看到
Invoke-RestMethod -Uri "http://localhost:5173/api/staged" | ConvertTo-Json

# Commit 該圖片
$commitBody = @{
  filename = "test.jpg"
  tags = @("test", "sample")
  rating = 3
  width = 0
  height = 0
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5173/api/staged/commit" -Method POST `
  -ContentType "application/json" -Body $commitBody | ConvertTo-Json
# 預期: { ok: true, data: { id: "...(16-char hex)...", record: {...} } }

# 確認圖片進入 images list
Invoke-RestMethod -Uri "http://localhost:5173/api/images" | ConvertTo-Json

# 確認 db.json 已建立於 collection root
Get-Content "C:\Temp\test-collection\db.json" | ConvertTo-Json
```

---

```powershell
# 12. 測試衝突偵測（在兩個 tab 同時 PATCH 同一張圖片）
# 先取得圖片的 updatedAt
$img = (Invoke-RestMethod -Uri "http://localhost:5173/api/images").data.items[0]
$id = $img.id
$updatedAt = $img.updatedAt

# 第一次 PATCH（成功）
$patchBody = @{ tags = @("updated"); rating = 4; expectedUpdatedAt = $updatedAt } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5173/api/images/$id" -Method PATCH `
  -ContentType "application/json" -Body $patchBody | ConvertTo-Json

# 第二次 PATCH（使用舊的 updatedAt → 應回傳 409）
$patchBody2 = @{ tags = @("conflict"); rating = 5; expectedUpdatedAt = $updatedAt } | ConvertTo-Json
try {
  Invoke-RestMethod -Uri "http://localhost:5173/api/images/$id" -Method PATCH `
    -ContentType "application/json" -Body $patchBody2
} catch {
  $_.Exception.Response.StatusCode  # 預期: 409
}
```

---

```powershell
# 13. 測試圖片代理（需要 committed 圖片）
# $id = 上面 commit 的圖片 ID
$ext = $img.ext  # 例如 '.jpg'
# 開啟瀏覽器或用 curl 訪問:
# http://localhost:5173/img/committed/${id}${ext}
# 預期：直接顯示圖片
```

---

```powershell
# 14. 測試 Setup 路徑無效重導向
# 手動修改 server.json 為不存在的路徑
@{ collectionRoot = "C:\NonExistent\Path" } | ConvertTo-Json | Set-Content .\server.json

# 訪問 http://localhost:5173/
# 預期：重導向至 /setup?alert=error

# 恢復正確路徑
$restoreBody = @{ collectionRoot = "C:\Temp\test-collection" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5173/api/setup" -Method POST `
  -ContentType "application/json" -Body $restoreBody | ConvertTo-Json
```

---

## 五、下一個 Agent 的接手指引

1. **先讀** `docs_init.md`（初始化歷史）、`docs_plan.md`（完整技術規格）、`docs_structure.md`（目錄結構規劃）
2. **再讀** 本文件（`docs_report1.md`）確認 Phase 0-1 完成狀態
3. **從 Phase 2 開始**：建立 `src/app.css`（全域樣式）→ 更新 `+layout.svelte` 匯入 css → 建立 `src/lib/components/` 各 Svelte 元件
4. **Phase 2 後的 Phase 3.0**：完善 setup 頁面（使用 Alert.svelte），之後按 3.1 → 3.2 → ... 順序推進
5. **注意事項**：所有 SvelteKit `+server.ts` 路由都使用泛型 `RequestHandler` 型別（from `@sveltejs/kit`），未使用路由特定的 `$types`，若有需要可改用 route-specific types 提升型別精度
6. **`@types/node`** 是 `@sveltejs/adapter-node` 的傳遞依賴，已存在於 `node_modules/`，但尚未加入 `package.json` devDependencies（可補上：`"@types/node": "^25.3.3"`）
