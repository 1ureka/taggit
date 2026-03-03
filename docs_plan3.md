# Image Manager — SvelteKit 實作計畫 v3

> **撰寫**：2026-03-03，基於對當前後端原始碼的完整逐行分析
> **取代**：`docs_plan2.md`（後端架構已大幅重構，plan2 的 API 路徑與 response 格式描述已部分過時）
> **必讀**：實作者必須先閱讀本文件再動手，**不可跳過任何 section**

---

## 〇、專案定位

**私人本地工具**——管理本地圖片集的 tagging / rating / browsing 工具。
單人使用、不部署雲端、不對外公開。

---

## 一、技術決策（不變）

| 項目 | 決策 |
|------|------|
| 框架 | SvelteKit (adapter-node) + TypeScript |
| 即時同步 | **移除 WebSocket**。衝突在 PATCH 時以 `updatedAt` 偵測 |
| 狀態管理 | Server SSR load = single source of truth；不建全域 client store |
| 依賴 | svelte + @sveltejs/kit + typescript + @types/node，不引入額外 lib |
| 衝突處理 | PATCH 帶 `expectedUpdatedAt`，不符回 409，UI 提示 reload |

---

## 二、後端架構現況（Phase 1 ✅ 已完成）

### 2.1 模組結構

```
src/lib/
  types.ts                  型別定義（共用 client + server）
  utils.ts                  工具函式（共用 client + server）
  client/
    api.ts                  client-side fetch 封裝
  server/
    config.ts               server.json I/O + 路徑管理
    db.ts                   JSONDatabase 類別 + HMR-safe singleton
    db-query.ts             純讀查詢函式（接受 db 實例）
    db-mutation.ts          寫入/變更函式（接受 db 實例）
    helpers.ts              路由共用 helpers（server-only）
    validation.ts           輸入驗證（pure functions）
```

> ⚠ **與 plan2 的重大差異**：
> - plan2 預期 `db.ts` 匯出扁平 API；**現在** `db.ts` 只含類別與 singleton，查詢分到 `db-query.ts`，寫入分到 `db-mutation.ts`。
> - plan2 預期 `params.ts`；**現在** 查詢參數解析移入 `utils.ts`（`parseQueryParams`），**client + server 共用**。
> - `helpers.ts` 是新加入的 server-only 輔助層，plan2 未明確說明。

---

### 2.2 db.ts — JSONDatabase 類別

`JSONDatabase` 封裝所有記憶體狀態：

| Field | 說明 |
|-------|------|
| `data: DBData` | `{ version, images: Record<id, ImageRecord> }` |
| `tagIndex: Map<string, Set<string>>` | 反向索引：tag → imageId 集合 |
| `ratingIndex: Map<number, Set<string>>` | 反向索引：rating → imageId 集合 |
| `dirty: boolean` | 是否有未持久化的變更 |
| `flushTimer` | debounce 500ms 後 flush 的 timer handle |
| `currentRoot: string \| null` | 當前 collection 根目錄 |
| `loaded: boolean` | 是否已成功 load collection |

主要 lifecycle 方法：`loadCollection(rootPath)`, `flush()`, `markDirty()`, `isLoaded()`, `getCurrentRoot()`。

索引維護：`buildIndexes()` (全量重建), `indexAdd(id, rec)`, `indexRemove(id, rec)`.

### 2.3 db-query.ts — 查詢函式

所有函式第一個參數為 `JSONDatabase` 實例（方便測試）：

| 函式 | 說明 |
|------|------|
| `getImage(db, id)` | 回傳 `ImageWithId \| null` |
| `hasImage(db, id)` | 回傳 `boolean` |
| `allImageEntries(db)` | 回傳 `[id, ImageRecord][]` |
| `queryImages(db, opts)` | 統一查詢（過濾、排序、分頁），回傳 `QueryResult` |
| `filterIds(db, tags, rating, ratingOp)` | 回傳符合條件的 id `Set<string>` |
| `getAllTags(db)` | 回傳 `TagInfo[]`（依 count 降冪） |
| `getImageCount(db)` | 回傳 committed 圖片數 |
| `getTagCount(db)` | 回傳 distinct tag 數 |

### 2.4 db-mutation.ts — 寫入函式

| 函式 | 說明 |
|------|------|
| `addImage(db, id, record)` | 新增 committed 圖片記錄 |
| `removeImage(db, id)` | 移除 committed 圖片記錄，回傳舊 record |
| `updateImage(db, id, patch, expectedUpdatedAt)` | 樂觀鎖更新 tags/rating；衝突時拋出 `{ status: 409, record }` |
| `renameTag(db, oldName, newName)` | 全域 rename tag，回傳影響數量 |

> 無 `moveToTrash` / `restoreFromTrash` 函式——**垃圾桶是 pure filesystem**，不需要 DB record。

### 2.5 helpers.ts — 路由 helpers（server-only）

| 函式 | 說明 |
|------|------|
| `guardLoaded()` | DB 未載入時回傳 503 Response，否則 null |
| `getPaths()` | 取得當前 collection 的路徑集合 |
| `getStagedFiles()` | 讀 staged/ 目錄，回傳圖片檔名排序列表 |
| `getTrashFiles()` | 讀 trash/ 目錄，回傳圖片檔名排序列表 |
| `uniqueFilename(dir, name)` | 找出唯一檔名（自動加 `_1`, `_2`...） |
| `parseBody<T>(request)` | 解析 JSON body，失敗回傳 `[null, 400 Response]` |

### 2.6 utils.ts — 共用工具（client + server）

`parseQueryParams(url: URL): QueryOptions` — 從 URL searchParams 解析出完整查詢選項（tags、rating、ratingOp、sort、order、page、limit）。

`parseTags(raw: string | null): string[]` — 解析逗號分隔的 tag 字串。

`formatDate(ms)`, `formatSize(bytes)`, `debounce(fn, ms)`, `throttle(fn, ms)` — UI 輔助。

### 2.7 client/api.ts — client fetch 封裝

`api.get<T>(url)`, `api.post<T>(url, body)`, `api.patch<T>(url, body)`, `api.delete<T>(url)` — 統一回傳 `{ ok, data?, error?, status }`。

**用於 client-heavy 頁面（tagger, editor, browse, scroll, compare）。不可從 server-only 模組 import。**

---

## 三、圖片狀態機

```
[staged/]  ──POST /api/staged/[filename]──→  [committed/]  (有 DB record)
[staged/]  ──DELETE /api/staged/[filename]──→  [trash/]    (無 DB record)

[committed/]  ──DELETE /api/images/[id]──→  [trash/]       (DB record 刪除)

[trash/]  ──POST /api/trash/[filename]──→  [staged/]       (無 DB record)
[trash/]  ──DELETE /api/trash/[filename]──→  🗑 永久刪除
[trash/]  ──DELETE /api/trash (全清)──→  🗑 永久刪除全部
```

> **重點**：垃圾桶是純 filesystem。`trash/` 目錄的檔案**沒有 DB record**。
> committed 圖片刪除時，檔案移到 trash 但 DB record 同時移除（`removeImage`）。
> staged 刪除為 trash 後，若要還原，只能還原到 staged 等待重新提交。

---

## 四、完整 API 規格（當前實作）

> ⚠ **與 plan2 差異**：以下為**實際程式碼確認**的正確路徑與 response 格式。

### 4.1 Setup

| Method | Path | Body | Response data |
|--------|------|------|---------------|
| GET | `/api/setup` | — | `{ collectionRoot: string \| null }` |
| POST | `/api/setup` | `{ collectionRoot }` | `{ collectionRoot: string }` |

### 4.2 Images（committed）

| Method | Path | 說明 | Response data |
|--------|------|------|---------------|
| GET | `/api/images` | 查詢（支援完整 QueryOptions） | `QueryResult` |
| GET | `/api/images/[id]` | 取單筆 | `ImageWithId` |
| PATCH | `/api/images/[id]` | 更新 tags/rating（必帶 `expectedUpdatedAt`） | `ImageWithId` |
| DELETE | `/api/images/[id]` | 移入 trash + 刪除 DB record | `{}` |

> `GET /api/images?sort=random&limit=2` = "random pair"（**無獨立 random-pair 端點**）。

### 4.3 Staged

| Method | Path | Body | Response data |
|--------|------|------|---------------|
| GET | `/api/staged` | — | `{ files: string[] }` |
| POST | `/api/staged/[filename]` | `{ tags, rating, width?, height? }` | `{ id: string, record: ImageRecord }` |
| DELETE | `/api/staged/[filename]` | — | `{ trashName: string }` |

> ⚠ plan2 描述的 `POST /api/staged/commit` 與 `POST /api/staged/trash` **不存在**。
> 正確路徑：filename 在 URL param，HTTP verb 區別 commit(POST) vs trash(DELETE)。

### 4.4 Trash

| Method | Path | 說明 | Response data |
|--------|------|------|---------------|
| GET | `/api/trash` | 列出 trash 檔案 | `{ files: string[] }` |
| DELETE | `/api/trash` | 清空 trash（全刪） | `{ deleted: number }` |
| POST | `/api/trash/[filename]` | 還原到 staged | `{ stagedName: string }` |
| DELETE | `/api/trash/[filename]` | 永久刪除單筆 | `{}` |

> ⚠ plan2 規範 B 寫 `GET /api/trash → res.data.items`，**實際是 `res.data.files`**。

### 4.5 Metadata

| Method | Path | 說明 | Response data |
|--------|------|------|---------------|
| GET | `/api/metadata/tags` | 列出所有 tag（依 count 降冪） | `{ tags: TagInfo[] }` |
| POST | `/api/metadata/tags` | rename tag（body: `{ oldName, newName }`） | `{ affected: number }` |
| GET | `/api/metadata/stats` | collection 統計 | `{ totalImages, totalTags, stagedCount, trashCount }` |

> ⚠ plan2 寫 `GET /api/tags`，**實際路徑為 `/api/metadata/tags`**。

### 4.6 Maintenance

| Method | Path | 說明 | Response data |
|--------|------|------|---------------|
| GET | `/api/maintenance/orphans` | 列出 committed/ 中無 DB record 的檔案 | `{ orphans: string[] }` |
| DELETE | `/api/maintenance/orphans` | 刪除所有孤立檔案 | `{ deleted: string[] }` |
| GET | `/api/maintenance/missing` | 列出 DB record 中檔案不存在磁碟的項目 | `{ missing: string[] }` |
| DELETE | `/api/maintenance/missing` | 移除所有缺失檔案的 DB records | `{ removed: string[] }` |
| POST | `/api/maintenance/backup` | 建立 db.json 時間戳備份 | `{ backupPath: string }` (201) |

> ⚠ plan2 只有 GET；**實際 orphans 與 missing 都支援 DELETE（auto-fix）**。

### 4.7 圖片代理

```
GET /img/[area]/[file]
```

- `area` 必須為 `committed` / `staged` / `trash`
- `committed` → `Cache-Control: public, max-age=86400`
- `staged` / `trash` → `Cache-Control: no-cache, no-store, must-revalidate`

---

## 五、規範 B（修訂版）— API response 取值路徑

```
GET /api/staged              → res.data.files     (string[])
GET /api/metadata/tags       → res.data.tags      (TagInfo[])
GET /api/metadata/stats      → res.data.{totalImages, totalTags, stagedCount, trashCount}
GET /api/trash               → res.data.files     (string[])
GET /api/maintenance/orphans → res.data.orphans   (string[])
GET /api/maintenance/missing → res.data.missing   (string[])
POST /api/staged/[filename]  → res.data.{id, record}
DELETE /api/staged/[filename]→ res.data.trashName
DELETE /api/images/[id]      → res.ok (no data)
POST /api/trash/[filename]   → res.data.stagedName
DELETE /api/maintenance/orphans → res.data.deleted (string[])
DELETE /api/maintenance/missing → res.data.removed (string[])
POST /api/maintenance/backup → res.data.backupPath
POST /api/metadata/tags      → res.data.affected (number)
```

---

## 六、尚未實作的端點

目前以下端點在 plan2 / Editor 頁面有需求但**尚未在 codebase 中實作**：

| 端點 | 說明 | 需求來源 |
|------|------|----------|
| `POST /api/images/[id]/restore` | 已提交圖片從 trash 還原（committed 刪除後） | Editor「還原」功能 |

> **注意**：`DELETE /api/images/[id]` 已將檔案移入 trash 並刪除 DB record，但 trash 中的檔案沒有原始 id 資訊（只有原始檔名），目前只能透過 `POST /api/trash/[filename]` 還原到 staged，無法直接還原為 committed 狀態。Editor 的「還原」功能需要重新評估設計（見第八節）。

---

## 七、hooks.server.ts — redirect guard

- `ensureServerJson()` 在 startup 執行
- SIGINT / SIGTERM → flush DB → exit（HMR-safe，僅註冊一次）
- 白名單：`/setup`, `/api/setup`, `/_app/`, `/favicon`
- `collectionRoot` 未設定 → 303 `/setup?alert=default`
- `collectionRoot` 設定但目錄無效 → 303 `/setup?alert=invalid`
- 第一次訪問有效路徑時自動 `loadCollection`

---

## 八、Editor「還原」功能設計決策

`DELETE /api/images/[id]` 刪除後：
- committed 檔案以 `originalName`（可能重命名）移至 trash
- DB record 徹底移除（無法從 id 找回）

兩種設計方向：

**方案 A（簡化）**：Editor 的「還原」按鈕改為顯示 `POST /api/trash/[filename]`，把檔案還原回 staged 重新提交。Editor 刪除後直接跳轉 `/`。

**方案 B（完整）**：新增 `POST /api/images/[id]/restore` 端點，從 trash 找回對應檔案（以 originalName 或 trashName 對應）重新建立 DB record。需要 trash 有額外的 metadata 或約定命名規則。

> **建議採用方案 A**——垃圾桶已有還原機制，Editor 不需要額外 restore 端點。調整 Editor UI 說明即可。

---

## 九、Phase 2 — 全域樣式 + 共用元件

> 內容與 plan2 第四節一致，以下僅補充需**修正的細節**。

### 9.1 全域樣式

建立 `src/app.css`（在 `+layout.svelte` 匯入），完整移植 `old-ref/public/shared/style.css` + `components.css`。

**CSS Variables / 動畫 / 按鈕體系 / Chip / Rating / Progress / Kbd / Badge / Skeleton 全部與 plan2 第四節一致，此處不重複。**

### 9.2 共用元件

| 元件 | 路徑 | 說明 |
|------|------|------|
| `Toast.svelte` | `src/lib/components/` | 見 plan2 §4.2.1 |
| `ConfirmModal.svelte` | `src/lib/components/` | 見 plan2 §4.2.2 |
| `Rating.svelte` | `src/lib/components/` | 見 plan2 §4.2.3 |
| `TagChips.svelte` | `src/lib/components/` | 見 plan2 §4.2.4 |
| `TagAutocomplete.svelte` | `src/lib/components/` | 見 plan2 §4.2.5（最複雜） |
| `FilterBar.svelte` | `src/lib/components/` | 見 plan2 §4.2.6 |
| `ImagePreview.svelte` | `src/lib/components/` | 見 plan2 §4.2.7 |
| `ImageCard.svelte` | `src/lib/components/` | 見 plan2 §4.2.8 |
| `Alert.svelte` | `src/lib/components/` | 見 plan2 §4.2.9 |

Toast store 建立：`src/lib/stores/toast.ts`

### 9.3 圖標

安裝 `@tabler/icons-svelte` 或手動嵌入 SVG。必要圖標列表見 plan2 §4.3。

### 9.4 更新 Setup 頁面

將 `setup/+page.svelte` 的 inline 樣式替換為全域 CSS + Alert.svelte 元件。

---

## 十、Phase 3 — 頁面實作

### ⚠ 通用規範（適用所有頁面）

1. **必先閱讀對應 old-ref** 的 `index.html` + `app.js` + `style.css`
2. **Toast 訊息文字**必須與 old-ref 一致（中文）
3. **空狀態**提示文字必須與 old-ref 一致
4. **動畫** fadeIn / slideUp / scaleIn 必須保留
5. **不需要 WebSocket**——所有 WS 相關行為移除
6. **API response 取值**按 `{ ok, data: { ... } }` 格式取（見第五節修訂版規範 B）
7. **API 路徑**使用本文件第四節的正確路徑，**不使用 plan2 的舊路徑**

---

### 10.0 首頁 `/`（完成度：骨架已有，需加樣式）

> **對標**：`old-ref/public/index.html`

- 佈局：max-width 640px, 垂直居中
- 5 張導航卡片：Tagger / Editor / Browse / Scroll / Compare
- 底部統計：`+page.server.ts` 已回傳 stats（直接用 SSR data）
- 底部「⚙ 設定」連結 → `/setup`

---

### 10.1 Tagger `/tagger`

> **對標**：`old-ref/public/tagger/`
> **完整規格**見 plan2 §5.2（三欄佈局、鍵盤快捷鍵、Undo Stack、工具 Modal 等）

**API 路徑修正（plan2 §5.2 舊路徑 → 正確路徑）**：

| 操作 | ❌ plan2 舊路徑 | ✅ 正確路徑 |
|------|----------------|------------|
| 列出 staged | `GET /api/staged` | `GET /api/staged`（相同） |
| 取得 tags | `GET /api/tags` | `GET /api/metadata/tags` |
| 提交圖片 | `POST /api/staged/commit` body `{filename, ...}` | `POST /api/staged/[filename]` body `{tags, rating, width?, height?}` |
| 刪除 staged | `POST /api/staged/trash` | `DELETE /api/staged/[filename]` |

**工具 Modal API 路徑修正**：

| 操作 | ❌ plan2 舊路徑 | ✅ 正確路徑 |
|------|----------------|------------|
| 檢查孤立 | `GET /api/maintenance/orphans` | 相同（但可搭配 DELETE 自動修復） |
| 檢查缺失 | `GET /api/maintenance/missing` | 相同（但可搭配 DELETE 自動修復） |
| 標籤重命名 | `POST /api/tags/rename` | `POST /api/metadata/tags` body `{oldName, newName}` |
| 資料庫備份 | `POST /api/maintenance/backup` | 相同 |
| 清空垃圾桶 | `DELETE /api/trash` | 相同（response: `res.data.deleted` 為數字） |

---

### 10.2 Editor `/editor`

> **對標**：`old-ref/public/editor/`
> **完整規格**見 plan2 §5.3（Search View / Edit View、Auto-save、409 衝突）

**API 路徑修正**：

| 操作 | ❌ plan2 舊路徑 | ✅ 正確路徑 |
|------|----------------|------------|
| 搜尋圖片 | `GET /api/images?limit=200` | 相同 |
| 取得 tags | `GET /api/tags` | `GET /api/metadata/tags` |
| 存檔 | `PATCH /api/images/{id}` | 相同（必帶 `expectedUpdatedAt`） |
| 移入垃圾桶 | `DELETE /api/images/{id}` | 相同 |
| **還原** | `POST /api/images/{id}/restore` | ❌ **此端點不存在** |

**還原功能改為**（採用方案 A）：
- Editor 刪除圖片後直接導向 `/`，不顯示「還原」按鈕
- 需要還原請進入 Tagger 等候（trash → staged → recommit）
- 或未來擴充實作 `POST /api/images/[id]/restore`

---

### 10.3 Browse `/browse`

> **對標**：`old-ref/public/browse/`
> **完整規格**見 plan2 §5.6（Filter View + Player View）

**API 路徑修正**：

| 操作 | ❌ plan2 舊路徑 | ✅ 正確路徑 |
|------|----------------|------------|
| 取得 tags | `GET /api/tags` | `GET /api/metadata/tags` |
| 即時計數 | `GET /api/images?limit=1&page=1&...` | 相同 |
| 開始播放 | 多頁 `GET /api/images?page=N&limit=200&...` | 相同 |

---

### 10.4 Scroll `/scroll`

> **對標**：`old-ref/public/scroll/`
> **完整規格**見 plan2 §5.4（無限捲動、Filter Bar）

**API 路徑修正**：

| 操作 | ❌ plan2 舊路徑 | ✅ 正確路徑 |
|------|----------------|------------|
| 取得 tags | `GET /api/tags` | `GET /api/metadata/tags` |
| 查詢圖片 | `GET /api/images?page=...&limit=30&...` | 相同 |

---

### 10.5 Compare `/compare`

> **對標**：`old-ref/public/compare/`
> **完整規格**見 plan2 §5.5（兩欄比較、Space 換組）

**API 路徑修正**：

| 操作 | ❌ plan2 舊路徑 | ✅ 正確路徑 |
|------|----------------|------------|
| 取得 tags | `GET /api/tags` | `GET /api/metadata/tags` |
| 取得隨機對 | `GET /api/random-pair` | `GET /api/images?sort=random&limit=2&...` |
| 計數 | `GET /api/images?limit=1&page=1&...` | 相同 |

> **response 格式**：`GET /api/images` 回傳 `QueryResult`，取兩張圖為 `res.data.items[0]` 與 `res.data.items[1]`。
> plan2 規範 B 的 `res.data.pair` **不存在**；應改為 `res.data.items`。

---

## 十一、Phase 4 — 收尾

### 11.1 驗證清單

- [ ] 所有 API 端點功能正常（依第四節完整列表）
- [ ] 衝突模擬：開兩分頁同時編輯同一張 → 後者收到 409
- [ ] Setup redirect guard：刪除 server.json → 重導 `/setup?alert=default`
- [ ] Staged 為空時的 empty state（Tagger）
- [ ] 圖片被外部刪除時的 graceful handling（missing check）
- [ ] 切換 collection：flush 舊 → load 新 → redirect `/`
- [ ] Compare 頁面結果少於 2 張時顯示 empty state
- [ ] Tagger 工具 Modal 的 orphans / missing DELETE auto-fix 功能

### 11.2 效能驗證

- Browse player：1000+ 張圖流暢（虛擬化 + DOM 池化）
- Scroll：infinite scroll 不卡（IntersectionObserver + throttle）
- Tagger：commit 後切換下一張 < 200ms 體感

---

## 十二、強制規範（修訂版）

### 規範 A：實作前必先閱讀 old-ref

每個頁面必須 **逐行閱讀** `old-ref/public/<頁面>/app.js` + `index.html` + `style.css`。
色彩、間距、字型、按鈕位置、操作順序、提示訊息文字（中文），**全部與 old-ref 一致**。

### 規範 B（修訂）：API response 格式

見本文件**第五節**（修訂版）。取資料時：
- `GET /api/staged` → `res.data.files`
- `GET /api/metadata/tags` → `res.data.tags`
- `GET /api/metadata/stats` → `res.data` 直取各 key
- `GET /api/trash` → `res.data.files`（**非 items**）
- `GET /api/images?sort=random&limit=2` → `res.data.items[0]` 與 `[1]`（**非 res.data.pair**）
- `GET /api/maintenance/orphans` → `res.data.orphans`
- `GET /api/maintenance/missing` → `res.data.missing`

### 規範 C：tags rename 欄位

Body 必須使用 `{ oldName, newName }`，端點為 `POST /api/metadata/tags`。

### 規範 D：PATCH 必帶 expectedUpdatedAt

Editor 的每次 `PATCH /api/images/[id]` 都必須帶 `expectedUpdatedAt`。
收到 200 → 更新本地 `updatedAt`。收到 409 → toast **「此圖片已被修改，請重新整理」**。

### 規範 E：commit 至少一個 tag

`POST /api/staged/[filename]` 空 tags → 400。前端應先擋（toast error）。

### 規範 F：不需要 WebSocket

所有 old-ref 中的 WS 行為一律刪除。

### 規範 G：db.ts 只管資料

**絕對不要**把 `fs.*` 呼叫放進 `db.ts` / `db-query.ts` / `db-mutation.ts`。
所有檔案系統操作都在 route 或 helpers.ts 裡完成。

### 規範 H：random-pair = query 的特例

**不存在 `/api/random-pair` 端點**。Compare 頁面用 `GET /api/images?sort=random&limit=2&...`。
回傳的是 `QueryResult`，items 陣列長度可能 < 2（圖庫不足，需顯示 empty state）。

### 規範 I：staged trash 不加前綴

plan2 說 `staged_{timestamp}_` 前綴；**實際程式碼使用 `uniqueFilename()` 處理衝突**，不加時間戳前綴。前端顯示 trash 檔名時不需要剝除前綴。

### 規範 J：image ID 格式

`crypto.randomBytes(8).toString("hex")` → 16 字元小寫 hex（`^[0-9a-f]{16}$`）。
驗證使用 `isValidId()`。

---

## 十三、開發順序建議

```
Phase 2:   全域 CSS + 共用元件（Toast, TagAutocomplete 最關鍵）
           → 更新 Setup 頁面樣式
Phase 3.0: 首頁（加樣式 + 確認 SSR stats 正確）
Phase 3.4: Scroll（中等複雜度，練手 client fetch）
Phase 3.5: Compare（修正 random-pair → queryImages，驗證 empty state）
Phase 3.3: Editor（auto-save + 409 衝突，移除 restore 功能）
Phase 3.2: Tagger（最複雜，修正 commit/trash API 路徑）
Phase 3.6: Browse（最 client-heavy，player DOM 池化）
Phase 4:   收尾驗證
```

---

## 十四、頁面互動強度（不變）

| 頁面 | SSR | Client | 說明 |
|------|-----|--------|------|
| `/setup` | ● | ○ 表單 | 純表單頁面 |
| `/` | ● | ○ | 靜態展示（SSR stats） |
| `/scroll` | ◐ | ◐ | 首頁 SSR，後續 client fetch |
| `/compare` | ◐ | ◐ | Tags SSR，配對 client fetch |
| `/editor` | ◐ | ● | 圖片 SSR load，編輯全 client |
| `/tagger` | ◐ | ● | Staged list SSR，核心操作全 client |
| `/browse` | ◐ | ● | 篩選 SSR，播放器 100% client DOM |
