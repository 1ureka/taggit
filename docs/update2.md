# Update 2：淘汰 `originalName`，改為可編輯的 `name` 欄位

## 目標

將 `ImageRecord.originalName`（唯讀、僅紀錄提交時的原始檔名）替換為 `ImageRecord.name`（可編輯的元資料字串）。

### 設計原則

- `name` 是**純元資料**——它不對應任何檔案系統中的實際檔名，允許重複，本質上只是一個使用者可自訂的標籤。
- 檔案系統中，committed 圖片的檔名始終是 `{id}{ext}`（如 `a1b2c3d4e5f6g7h8.png`），刪除時進入垃圾桶也沿用此命名（以 `uniqueFilename` 處理碰撞）。
- 不需要任何名稱唯一性索引或名稱查重邏輯。既有的 409 樂觀併發防護（`expectedUpdatedAt`）維持不變。

---

## 一、型別變更

### `src/lib/types.ts`

| 變更 | 說明 |
|------|------|
| `ImageRecord.originalName` → `name` | 語義變為「使用者可自訂的圖片名稱」 |
| `QueryOptions.sort` | `"originalName"` → `"name"` |
| `QueryOptions.search` | 註解改為 `name substring search` |

---

## 二、資料庫層

> 不需要任何新索引。`name` 是普通字串欄位，無唯一性約束。

### `src/lib/server/db-query.ts`

| 函數 | 變更 |
|------|------|
| `queryImages()` | 排序分支 `"originalName"` → `"name"`，取值改用 `a.name` |
| `filterIds()` | 搜尋邏輯 `rec.originalName` → `rec.name`；註解同步更新 |

### `src/lib/server/db-mutation.ts`

`updateImage()` 的 `patch` 型別擴展為 `{ tags?: string[]; rating?: number; name?: string }`：

- 當 `patch.name !== undefined` 時，更新 `rec.name`

### `src/lib/server/validation.ts`

新增名稱驗證：

```ts
/** name 必須為非空字串，長度 ≤ 200 */
export function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}
```

---

## 三、API 層

### `PATCH /api/images/[id]`（`src/routes/api/images/[id]/+server.ts`）

擴展接受 `name` 欄位：

1. 若 body 含 `name`，以 `isValidName()` 驗證，不合法回 400
2. 將 `name` 傳入 `updateImage()` 的 `patch`（無需查重）

### `POST /api/staged/[filename]`（`src/routes/api/staged/[filename]/+server.ts`）

提交時以原始檔名（去除副檔名）作為初始 `name`：

```ts
const name = path.basename(filename, ext);
```

直接寫入 `record.name`，不做碰撞處理。

### `DELETE /api/images/[id]`

垃圾桶檔名改用 `id + ext`（而非 `originalName`），保持與 committed 目錄一致的命名邏輯：

```ts
const trashName = uniqueFilename(paths.trash, id + image.ext);
```

---

## 四、前端 — 工具與元件

### `src/lib/utils.ts`

`parseQueryParams()` 的 sort 解析：`"originalName"` → `"name"`。

### `src/lib/components/FilterBar.svelte`

排序選項 `{ value: "originalName", label: "檔名" }` → `{ value: "name", label: "名稱" }`。

---

## 五、前端 — Editor 路由（名稱編輯的主要 UI）

### `src/routes/editor/[id]/EditorPanel.svelte`

- 刪除「原始檔名」唯讀顯示
- 新增可編輯的名稱輸入框（`<input>`），綁定 `image.name`
- 失焦或 Enter 時觸發 `ui.handleNameBlur` / `ui.handleNameKeydown`
- 顯示格式錯誤訊息（空白、超長）

### `src/routes/editor/[id]/editorPanel.svelte.ts`

- 新增 `nameError` 狀態（`$state<string>("")`）
- 新增 `handleNameBlur()` / `handleNameKeydown()` — 驗證名稱格式，無誤則 `markDirty()`
- `saveChanges()` 的 PATCH body 加入 `name`

### `src/routes/editor/[id]/+page.svelte`

頁面標題與 header：`ctx.image?.originalName` → `ctx.image?.name`。

### `src/routes/editor/EditorList.svelte`

圖片卡片 alt 與名稱顯示：`img.originalName` → `img.name`。

---

## 六、前端 — 其他路由

| 檔案 | 變更 |
|------|------|
| `src/routes/browse/browseForm.svelte.ts` | Sort 型別與選項 `"originalName"` → `"name"`；預設 order 判斷同步更新 |
| `src/routes/browse/player/+page.svelte` | `images[i].originalName` → `images[i].name`（img alt） |
| `src/routes/scroll/ScrollMasonry.svelte` | `item.originalName` → `item.name`（img alt） |
| `src/routes/compare/CompareCard.svelte` | `image.originalName` → `image.name`（img alt） |

---

## 七、影響檔案總覽

```
src/lib/types.ts                               ← 型別重新命名
src/lib/utils.ts                               ← sort 解析
src/lib/server/db-query.ts                     ← 查詢、搜尋
src/lib/server/db-mutation.ts                  ← updateImage patch 擴展
src/lib/server/validation.ts                   ← isValidName
src/routes/api/images/[id]/+server.ts          ← PATCH 接受 name、DELETE 改用 id 作垃圾桶檔名
src/routes/api/staged/[filename]/+server.ts    ← 提交時寫入 name
src/lib/components/FilterBar.svelte            ← 排序選項
src/routes/editor/[id]/EditorPanel.svelte      ← 名稱編輯 UI
src/routes/editor/[id]/editorPanel.svelte.ts   ← 編輯邏輯
src/routes/editor/[id]/+page.svelte            ← title / header
src/routes/editor/EditorList.svelte            ← 列表顯示
src/routes/browse/browseForm.svelte.ts         ← sort 型別
src/routes/browse/player/+page.svelte          ← img alt
src/routes/scroll/ScrollMasonry.svelte         ← img alt
src/routes/compare/CompareCard.svelte          ← img alt
docs/frontend.md                               ← 範例中的 Sort 型別
```
