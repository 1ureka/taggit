# Image Manager 簡化重構計畫

> 本文件描述從 staged / committed / trash 三區制簡化為 staged + committed 兩態制的完整重構方案。目標是大幅減少程式碼量，使專案能夠被完成。
>
> **此重構不包含既有資料遷移。** 假設從全新的 collection 開始。

---

## 1. 架構總覽

### 1.1 新檔案系統

```
<collectionRoot>/
├── images/     ← 所有圖片（唯一的圖片目錄）
└── db.json     ← committed 圖片的記錄
```

不再有 `staged/`、`committed/`、`trash/` 子目錄。

### 1.2 圖片狀態判定

| 狀態      | 條件                                          |
| --------- | --------------------------------------------- |
| Staged    | 檔案存在於 `images/` **且** db.json 無此 key  |
| Committed | 檔案存在於 `images/` **且** db.json 有此 key  |

### 1.3 圖片生命週期

| 操作              | FS 操作              | DB 操作           |
| ----------------- | -------------------- | ----------------- |
| Upload            | 寫入 `images/`       | 無                |
| 手動放入資料夾    | （使用者自行操作）   | 無                |
| Commit staged     | **無**               | 新增 db.json 記錄 |
| Delete committed  | **無**               | 移除 db.json 記錄 |
| Delete staged     | 刪除檔案             | 無                |

只有 Upload 使用 `uniqueFilename()` 避免衝突。

### 1.4 識別符

- **不再使用隨機 hex ID**。圖片的唯一識別符 = 檔名（如 `photo.png`）。
- db.json 的 key = 檔名。
- 前端所有 `image.id` 的值 = 檔名。

---

## 2. 資料模型 — `src/lib/types.ts`

### 刪除

- `ImageArea` type
- `CollectionPaths` 中的 `.staged`、`.committed`、`.trash`
- `Stats.trashCount`
- `ImageRecord.ext`（副檔名已內含於檔名 key）

### 修改後的型別

```ts
interface CollectionPaths {
  root: string;
  images: string; // <root>/images
  db: string; // <root>/db.json
}

interface ImageRecord {
  name: string; // 使用者可編輯的顯示名稱
  tags: string[];
  rating: number; // 0–5
  committedAt: number; // Unix ms
  updatedAt: number; // Unix ms（樂觀鎖）
  fileSize: number;
  width: number;
  height: number;
  blurhash: string;
}

// id = 檔名，如 "photo.png"
interface ImageWithId extends ImageRecord {
  id: string;
}

interface Stats {
  totalImages: number;
  totalTags: number;
  stagedCount: number;
  // trashCount 移除
}
```

`QueryOptions`、`QueryResult`、`TagInfo`、`DBData`、`ServerConfig`、`ImageSize` 不變。

---

## 3. 後端模組（依檔案）

### 3.1 `src/lib/server/config.ts`

- `getCollectionPaths(root)`: 回傳 `{ root, images: path.join(root, "images"), db: path.join(root, "db.json") }`。
- `isCollectionValid(root)`: 只建立 `images/` 子目錄（移除 staged / committed / trash 的 `mkdirSync`）。
- `IMG_EXTS`、`MIME_TYPES`：不變。

### 3.2 `src/lib/server/db.ts`

- `loadCollection()`: 確認新目錄結構。
- 其餘（`flush`、`buildIndexes`、tag index）不變。

### 3.3 `src/lib/server/db-query.ts`

- 所有函式的 `id` 參數語意改為「檔名」，程式碼邏輯基本不變。
- `queryImages()` 回傳的 `ImageWithId.id` = 檔名。

### 3.4 `src/lib/server/db-mutation.ts`

- `addImage(db, filename, record)`: key 改為 filename。
- `removeImage(db, filename)`: 僅刪記憶體中的 DB 記錄，**不做任何 FS 操作**。
- `updateImage(db, filename, patch)`: id → filename。
- `renameTag()`: 不變。

### 3.5 `src/lib/server/helpers.ts`

- `getStagedFiles(paths)`: 讀取 `paths.images` 目錄，**過濾掉在 db.json 中有 key 的檔案**，回傳不在 DB 的圖片檔名列表。需 import `getDB`（或將 db 作為參數傳入）以取得 db.data.images。
- `getTrashFiles()`: **刪除**。
- `uniqueFilename()`: 保留不變。
- `requireDatabase()`、`requirePaths()`、`parseBody()`: 不變。

### 3.6 `src/lib/server/validation.ts`

- `isValidId()`: **刪除或改為 alias 到 `isValidFilename()`**。因為 ID 現在就是檔名。
- `isValidArea()`: **刪除**。
- 其餘不變。

### 3.7 `src/lib/server/thumbnail.ts`

- `getImage(area, file, sourcePath, size)` → `getImage(file, sourcePath, size)`: 移除 `area` 參數，cache key 從 `${area}/${file}@${size}` 改為 `${file}@${size}`。
- `getImageMeta()`: 不變。

---

## 4. API 路由

### 4.1 刪除（整個目錄）

| 路徑                                               | 原因                                           |
| -------------------------------------------------- | ---------------------------------------------- |
| `src/routes/api/trash/+server.ts`                  | trash 概念消失                                 |
| `src/routes/api/trash/[filename]/+server.ts`       | 同上                                           |
| `src/routes/api/maintenance/orphans/+server.ts`    | 新架構中「檔案存在但 DB 無記錄」就是 staged    |

### 4.2 修改

#### `src/routes/api/images/[id]/+server.ts` → 改為 `[filename]`

- 目錄重新命名：`src/routes/api/images/[id]/` → `src/routes/api/images/[filename]/`
- **GET**: `params.id` → `params.filename`，驗證改為 `isValidFilename()`。
- **PATCH**: `params.id` → `params.filename`，驗證同上。
- **DELETE**: `params.id` → `params.filename`。**移除所有 FS 操作**（不再 renameSync 到 trash）。僅執行 `removeImage(db, filename)`。

#### `src/routes/api/staged/+server.ts`

- **GET**: 回傳 `getStagedFiles(paths)`（實作已在 helpers.ts 中改變）。
- **POST (upload)**: 目的地從 `paths.staged` 改為 `paths.images`。

#### `src/routes/api/staged/[filename]/+server.ts`

- **POST (commit)**:
  - 移除 `crypto.randomBytes()` 產生 hex ID 的邏輯。
  - 移除 `fs.renameSync()` 檔案搬移。
  - 檢查檔案存在於 `paths.images/filename`。
  - 檢查 db.json 中尚無此 key（避免重複 commit）。
  - 從 `path.join(paths.images, filename)` 計算 `stat.size` 與 `getImageMeta()`。
  - `addImage(db, filename, record)`，其中 `name = path.basename(filename, ext)`。
- **DELETE (永久刪除)**:
  - 直接 `fs.unlinkSync(path.join(paths.images, filename))`。
  - 移除向 trash 搬移的邏輯。

#### `src/routes/api/metadata/+server.ts`

- **GET / POST**: 檔案路徑從 `path.join(paths.committed, id + record.ext)` 改為 `path.join(paths.images, filename)`。其中 `filename` 就是 db.json 的 key。

#### `src/routes/api/metadata/stats/+server.ts`

- 回傳中移除 `trashCount`，移除 `getTrashFiles` import。

#### `src/routes/api/maintenance/missing/+server.ts`

- 檔案路徑從 `path.join(paths.committed, id + rec.ext)` 改為 `path.join(paths.images, filename)`。

#### `src/routes/api/maintenance/setup/+server.ts`

- 不需功能改動，但 `isCollectionValid()` 內部已改變（見 §3.1）。

#### `src/routes/api/maintenance/cache/+server.ts`

- 不變。

#### `src/routes/api/maintenance/backup/+server.ts` — 完全重寫

見 **§6 備份 ZIP 功能**。

### 4.3 圖片 Serving 路由重構

**現有**: `src/routes/img/[area]/[file]/+server.ts`（接受 area 參數：committed / staged / trash）

**新**: `src/routes/img/[file]/+server.ts`（不再需要 area）

操作步驟：

1. 在 `src/routes/img/` 下建立 `[file]/+server.ts`。
2. 移除 `src/routes/img/[area]/` 整個目錄。
3. 新的 handler 中 `baseDir` 固定為 `paths.images`，移除 `isValidArea()` 驗證。保留 path traversal 防護。

---

## 5. 前端變更

### 5.1 `src/lib/client/api.ts`

```ts
// 現有
export function imgSrc(area: ImageArea, file: string, size?: ImageSize): string

// 改為
export function imgSrc(file: string, size?: ImageSize): string
// 產生: /img/${encodeURIComponent(file)}${size && size !== "xl" ? `?size=${size}` : ""}
```

**所有呼叫處**需移除第一個 area 引數。以下搜尋模式可定位所有需改動之處：

- `imgSrc("committed"` — committed 圖片的 URL
- `imgSrc("staged"` — staged 圖片的 URL
- `imgSrc("trash"` — trash 圖片的 URL（在刪除的 trash 路由中，無需處理）

### 5.2 首頁 — `src/routes/(home)/`

- `+page.server.ts`: 移除 `getTrashFiles` import 與 `stats.trashCount`。
- `+page.svelte`: 移除垃圾桶連結（`<a href="/trash">`）與 footer 中的垃圾桶項。移除 `trashCount` 顯示。

### 5.3 Tagger — `src/routes/tagger/`

- `taggerForm.svelte.ts`:
  - `#doTrash()` → 改名 `#doDelete()`。
  - 確認提示改為永久刪除語氣（如：「此操作將永久刪除圖片，無法復原。」）。
  - Toast 訊息從「已移至垃圾桶」改為「已永久刪除」。
- `TaggerForm.svelte`: 按鈕文字與圖示從 trash 概念改為永久刪除概念。
- `taggerPreview.svelte.ts`: `imgSrc("staged", ...)` → `imgSrc(...)`。
- `TaggerList.svelte`: `imgSrc("staged", ...)` → `imgSrc(...)`。

### 5.4 Editor — `src/routes/editor/`

- 所有 `imgSrc("committed", ...)` → `imgSrc(...)`。
- `DELETE /api/images/[id]` → `DELETE /api/images/[filename]`（URL 中的 path param）。
- `[id]/` 子路由：param 名稱可保留 `[id]`（SvelteKit 只是變數名），但語意上 `id` = 檔名。

### 5.5 Browse — `src/routes/browse/`

- `imgSrc("committed", ...)` → `imgSrc(...)`。

### 5.6 Scroll — `src/routes/scroll/`

- `imgSrc("committed", ...)` → `imgSrc(...)`。

### 5.7 Compare — `src/routes/compare/`

- `imgSrc("committed", ...)` → `imgSrc(...)`。

### 5.8 Settings — `src/routes/settings/`

#### `SettingsCollection.svelte`

說明文字從三個子目錄（staged / committed / trash）改為：

> `images/` — 所有圖片存放於此。

移除 `<li>committed/</li>` 和 `<li>trash/</li>`。

#### `settingsNav.svelte.ts`

導航項目無需特別修改（「系統維護」仍然存在，只是內容縮減）。

#### `SettingsMaintenance.svelte` + `settingsMaintenance.svelte.ts`

- **移除** 孤立檔案檢查 UI 與邏輯（`orphanResult`、`orphanList`、`orphanBusy`、`handleOrphanCheckClick`、`handleOrphanDeleteClick` 及對應模板）。
- **移除** 清空垃圾桶 UI 與邏輯（`trashResult`、`trashBusy`、`handleEmptyTrashClick` 及對應模板）。
- **修改** 備份功能：從顯示路徑改為觸發 ZIP 下載（見 §6.2）。

#### `SettingsImages.svelte` + `settingsImages.svelte.ts`

- 元資料路徑邏輯已在後端處理，前端 API 呼叫方式不變。

### 5.9 刪除

| 路徑                          | 原因            |
| ----------------------------- | --------------- |
| `src/routes/trash/` 整個目錄  | trash 概念消失  |

刪除的檔案清單：`+page.server.ts`、`+page.svelte`、`TrashForm.svelte`、`trashForm.svelte.ts`、`TrashList.svelte`、`trashList.svelte.ts`、`TrashListCard.svelte`、`TrashSelectionDock.svelte`、`trashSelectionDock.svelte.ts`。

---

## 6. 備份 ZIP 功能

### 6.1 後端 — `src/routes/api/maintenance/backup/+server.ts`

完全重寫。使用系統壓縮指令產生 ZIP，以 HTTP Response 回傳給前端下載。

```
流程:
1. requireDatabase() 取得 paths
2. db.flush() 確保 db.json 為最新
3. 產生暫存路徑: path.join(os.tmpdir(), `image-manager-backup-${timestamp}.zip`)
4. 根據 process.platform 執行壓縮指令（execSync）:
   - win32:
     powershell -NoProfile -Command "Compress-Archive -Path '<paths.images>','<paths.db>' -DestinationPath '<zipPath>' -Force"
   - linux / darwin:
     cd "<paths.root>" && zip -r "<zipPath>" images/ db.json
5. 成功: 讀取 zip 檔 → 回傳 new Response(buffer, {
     headers: {
       "Content-Type": "application/zip",
       "Content-Disposition": `attachment; filename="backup-${timestamp}.zip"`
     }
   })
6. finally: fs.unlinkSync(zipPath) 清理暫存
7. catch: 回傳 json({ ok: false, error: "系統缺少壓縮工具或權限不足，無法建立備份。請手動備份 images/ 目錄與 db.json。" })
```

注意：`execSync` 應包裹在 try-catch 中，若系統無 `zip` 或 `powershell` 報錯，直接回傳友善錯誤訊息。不安裝任何 npm 壓縮套件。

### 6.2 前端 — `settingsMaintenance.svelte.ts`

備份 handler 不再用 `api.post()` — 因為回傳的是 binary 而非 JSON，需直接用 `fetch`：

```ts
handleBackupClick = async () => {
  this.backupBusy = true;
  this.backupResult = "";
  try {
    const res = await fetch("/api/maintenance/backup", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      this.backupResult = "錯誤: " + (data.error || "未知");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.backupResult = "備份已下載";
  } catch {
    this.backupResult = "備份失敗";
  } finally {
    this.backupBusy = false;
  }
};
```

`SettingsMaintenance.svelte` 中備份區塊的說明文字改為：

> 將目前的圖片集（images/ 目錄與 db.json）打包為 ZIP 備份檔，下載至你的裝置。

---

## 7. 搜尋指南

以下 grep 搜尋模式可快速定位需修改的程式碼。在重構時逐一清查：

| 搜尋模式                  | 用途                                |
| ------------------------- | ----------------------------------- |
| `imgSrc("committed"`      | committed 圖片 URL（全部移除 area） |
| `imgSrc("staged"`         | staged 圖片 URL（全部移除 area）    |
| `imgSrc("trash"`          | trash 圖片 URL（應在刪除的檔案中）  |
| `ImageArea`               | 型別引用                            |
| `paths.staged`            | 路徑引用                            |
| `paths.committed`         | 路徑引用                            |
| `paths.trash`             | 路徑引用                            |
| `getTrashFiles`           | trash 檔案列表                      |
| `trashCount`              | 統計數字                            |
| `/api/trash`              | trash API 呼叫                      |
| `/api/maintenance/orphans`| orphan API 呼叫                     |
| `isValidArea`             | area 驗證                           |
| `record.ext`              | 取得副檔名（改為從 key 解析）       |
| `id + image.ext`          | 檔案路徑組合（改為直接用 filename） |
| `randomBytes`             | hex ID 生成（移除）                 |

---

## 8. 建議執行順序

1. **型別與資料模型**（`src/lib/types.ts`）
2. **後端核心模組**（config → helpers → validation → db-mutation → db-query → thumbnail）
3. **API 路由**（刪除 trash/orphans → 修改 staged → 修改 images/[filename] → 修改 metadata → 重寫 backup）
4. **圖片 serving 路由**（重構 `src/routes/img/`）
5. **前端共用**（`api.ts` 的 `imgSrc` 簽名）
6. **前端頁面**（首頁 → tagger → editor → browse → scroll → compare → settings）
7. **刪除 trash 前端**（`src/routes/trash/` 整個目錄）
8. **全域搜尋清查**（用 §7 的搜尋模式確認無殘留引用）
