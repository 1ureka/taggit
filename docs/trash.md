# 重構計畫 — `/trash`（已刪除檔案管理頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/trash/
├── +page.server.ts               ← SSR：queryTrashedImages（分頁查詢）
├── +page.svelte                  ← 頁面殼層 + 建立 store + 初始化 actions
├── stores.svelte.ts              ← 模組層級單例 store（trashStore, selectionStore, uiStore）
├── actions.ts                    ← 副作用函數（restore, permanentDelete, searchImages）
├── TrashSearch.svelte            ← 搜尋列元件
└── TrashSelectionDock.svelte     ← 底部選取操作列（批量還原 / 刪除）
```

共 **6 個檔案**。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ⚠️ 部分合規 | 有 store 初始化邏輯與 `$effect` |
| 子元件拆分 | ⚠️ 部分合規 | 有 TrashSearch / TrashSelectionDock，但缺少主體列表元件 |
| 無頭 UI 工廠函數 (.svelte.ts) | ❌ 不合規 | 子元件均無 `.svelte.ts`，使用模組層級 store |
| Context 傳遞 | ❌ 不合規 | 透過直接 import 單例 store 而非 Context |
| 純函式模組 | ⚠️ 部分合規 | actions.ts 含副作用但也含純邏輯 |

### 主要問題

1. **stores.svelte.ts — 模組層級單例**：
   - `trashStore`（images, total, currentPage, hasMore）
   - `selectionStore`（selected）
   - `uiStore`（loading, searchQuery）
   - 作用域污染：模組層級狀態在路由切換後不自動重置，可能殘留髒資料。
2. **actions.ts — 耦合 store**：`restoreImages`, `permanentDeleteImages`, `searchImages` 直接讀寫 store 單例。
3. **子元件缺少 `.svelte.ts`**：
   - `TrashSearch.svelte`：搜尋邏輯內嵌，無 `createTrashSearch`。
   - `TrashSelectionDock.svelte`：選取操作邏輯內嵌，**且使用硬編碼白色 dock 樣式**（`#ffffff`, `#000000`, `#555555`），不符合 theme 規範。
4. **`+page.svelte` 仍含業務邏輯**：包含 store 初始化、`$effect` 監聽、`handleLoadMore` 等。

---

## 二、重構目標

- 消除模組層級 store，改用工廠函數 + Context。
- 每個子元件配對 `.svelte.ts`。
- 頁面內的列表 UI 抽出為 `TrashList.svelte`。
- `+page.svelte` 僅做資料接收與子元件組裝。

---

## 三、目標檔案結構

```
src/routes/trash/
├── +page.server.ts                ← 不變
├── +page.svelte                   ← 僅接收 data，建立 Context，組裝子元件
├── TrashList.svelte               ← 列表 + 分頁載更多
├── trashList.svelte.ts            ← createTrashList（篩選、搜尋、分頁邏輯）
├── TrashSearch.svelte             ← 搜尋列 UI
├── trashSearch.svelte.ts          ← createTrashSearch
├── TrashSelectionDock.svelte      ← 底部操作列 UI
├── trashSelectionDock.svelte.ts   ← createTrashSelectionDock
└── helpers.ts                     ← 純函式（格式化、篩選等）
```

刪除 `stores.svelte.ts`、`actions.ts`。

---

## 四、Context 定義

```ts
// 在 trashList.svelte.ts 中定義，為頁面層級唯一 Context
import { createContext } from "$lib/client/context.js";
import type { ImageWithId } from "$lib/types.js";

type TrashState = {
  // 資料
  readonly images: ImageWithId[];
  readonly total: number;
  readonly hasMore: boolean;

  // 篩選
  searchQuery: string;

  // 選取
  readonly selected: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // 操作
  restoreSelected: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  loadMore: () => Promise<void>;
  search: (query: string) => Promise<void>;

  // UI
  readonly loading: boolean;
};

export const [getTrashState, setTrashState] = createContext<TrashState>();
```

---

## 五、各檔案職責

### 5.1 `+page.svelte`

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import { createTrashList, setTrashState } from "./trashList.svelte.js";
  import TrashList from "./TrashList.svelte";
  import TrashSearch from "./TrashSearch.svelte";
  import TrashSelectionDock from "./TrashSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  const state = createTrashList({
    initialImages: data.images,
    initialTotal: data.total,
  });
  setTrashState(state);
</script>

<svelte:head>
  <title>Trash — Image Manager</title>
</svelte:head>

<div class="trash-page">
  <TrashSearch />
  <TrashList />
  <TrashSelectionDock />
</div>
```

### 5.2 `trashList.svelte.ts`

- `createTrashList(options)` 工廠函數：
  - 建立所有響應式狀態（images, total, selected, searchQuery, loading）
  - 內含 `loadMore`、`restoreSelected`、`deleteSelected`、`search` 等非同步操作
  - 回傳符合 `TrashState` 介面的物件

### 5.3 `TrashSearch.svelte` / `trashSearch.svelte.ts`

- `createTrashSearch()`：透過 `getTrashState()` 取得 Context，封裝搜尋防抖邏輯。
- `TrashSearch.svelte`：UI — 搜尋輸入框 + 清除按鈕。

### 5.4 `TrashSelectionDock.svelte` / `trashSelectionDock.svelte.ts`

- `createTrashSelectionDock()`：透過 `getTrashState()` 取得 Context，封裝批量操作邏輯。
- `TrashSelectionDock.svelte`：UI — 底部浮動列。
- **修正硬編碼色彩**：將 `#ffffff` / `#000000` / `#555555` 替換為 `var(--bg)` / `var(--text)` / `var(--text-muted)` 等 token。

---

## 六、注意事項

- `/trash` 的結構與 `/editor` 高度相似（store + actions + search + selection dock），應使用相同的重構策略。
- `TrashSelectionDock` 的硬編碼顏色問題同見於 `EditorSelectionDock`，兩處應一併修正（見 [theme.md](./theme.md)）。
- `permanentDeleteImages` 操作需要二次確認對話框（ConfirmModal），確保重構後保留此流程。
