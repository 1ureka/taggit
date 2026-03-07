# 重構計畫 — `/editor`（搜尋頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/editor/
├── +page.server.ts              ← SSR：recent items + allTags
├── +page.svelte                 ← 頁面殼：initSearch + header + 組裝子元件
├── stores.svelte.ts             ← 3 個 module-level store（searchStore, selectionStore, uiStore）
├── actions.ts                   ← 搜尋 / 分頁 / 選取 / 批次刪除邏輯
├── EditorSearch.svelte          ← 搜尋 UI（搜尋框 + 篩選 + 卡片網格 + 分頁）
└── EditorSelectionDock.svelte   ← 底部選取操作 dock
```

共 **6 個檔案**。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ⚠️ 部分合規 | 包含 header 結構與快捷鍵提示，但可接受 |
| 子元件拆分 | ✅ 合規 | `EditorSearch` + `EditorSelectionDock` |
| 無頭 UI 工廠函數 | ❌ 不合規 | 兩個元件皆無 `.svelte.ts` |
| Store 模式 | ⚠️ 非標準 | Module-level singleton stores |

### 主要問題

1. **缺少無頭 UI**：`EditorSearch.svelte` 是純模板，邏輯全在 `actions.ts`，但缺少一個 `.svelte.ts` 來橋接。`EditorSelectionDock.svelte` 有本地 `$state`（`dockRating`）與 `$effect`，應抽至無頭 UI。
2. **`+page.svelte` 含 header 結構**：header 包含快捷鍵提示文案，雖不算業務邏輯但增加了頁面層的重量。
3. **EditorSelectionDock 硬編碼顏色**：使用 `#ffffff`, `#000000`, `#555555` 等（見 theme.md 已知技術債）。

---

## 二、重構目標

1. 為 `EditorSearch` 和 `EditorSelectionDock` 補齊無頭 UI。
2. 將 `+page.svelte` 的 header 結構移入一個子元件或保留（因為僅為靜態導航，可接受）。

---

## 三、目標檔案結構

```
src/routes/editor/
├── +page.server.ts              ← 不變
├── +page.svelte                 ← 瘦身：移除 header 內容至子元件
├── stores.svelte.ts             ← 不變
├── actions.ts                   ← 不變
├── EditorSearch.svelte          ← 瘦身
├── editorSearch.svelte.ts       ← 新增：搜尋 UI 狀態橋接
├── EditorSelectionDock.svelte   ← 瘦身
└── editorSelectionDock.svelte.ts ← 新增：dock rating 狀態 + reset 邏輯
```

---

## 四、各無頭 UI 設計

### 4.1 `editorSearch.svelte.ts`

`EditorSearch` 目前的 `<script>` 幾乎只有 import，實際邏輯在 `actions.ts`。無頭 UI 的職責為提供模板所需的衍生狀態：

```ts
export function createEditorSearch() {
  // EditorSearch.svelte 目前的 script 極為簡潔，
  // 但仍應以工廠函數形式封裝，確保規範統一。
  // 未來若新增本地 UI 狀態可在此擴充。
  return {};
}
```

> 由於 `EditorSearch` 的邏輯已全部在 `actions.ts` 中，此檔案可為近乎空殼。但為規範一致性仍建議建立。

### 4.2 `editorSelectionDock.svelte.ts`

```ts
import { selectionStore } from "./stores.svelte.js";

export function createEditorSelectionDock() {
  let dockRating = $state(0);
  let count = $derived(selectionStore.selected.size);

  // 每當 selection 變更時重設 rating
  $effect(() => {
    count; // depend on count
    dockRating = 0;
  });

  return {
    get count() { return count; },
    get dockRating() { return dockRating; },
    set dockRating(v) { dockRating = v; },
  };
}
```

---

## 五、關於 Header

當前 `+page.svelte` 的 header 包含：
- 返回首頁連結
- 頁面標題
- 快捷鍵提示

**建議**：保持在 `+page.svelte`，因為：
- 僅為靜態導航結構
- 不包含業務邏輯
- 頁面層允許有布局樣式

或可選擇抽成一個純展示的 `EditorHeader.svelte`（無需 `.svelte.ts`）。

---

## 六、注意事項

- `+page.server.ts` 與 `actions.ts` 不需修改。
- `EditorSelectionDock` 的硬編碼顏色問題歸屬 theme.md 處理範圍。
