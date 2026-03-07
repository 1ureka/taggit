# 重構計畫 — `/editor/[id]`（編輯頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/editor/[id]/
├── +page.server.ts        ← SSR：getImage(db, params.id)
├── +page.svelte           ← 頁面殼：initEdit + auto-save $effect + 組裝子元件
├── stores.svelte.ts       ← 2 個 module-level store（editStore, uiStore）
├── actions.ts             ← 編輯 / 存檔 / 復原 / 刪除 / 確認 / 鍵盤
├── EditorPreview.svelte   ← 圖片預覽區（zoom/pan）
└── EditorInfoPanel.svelte ← 右側資訊面板（rating + 標籤 + metadata）
```

共 **6 個檔案**。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ⚠️ 部分合規 | 含 auto-save `$effect` 與 `$derived`（previewFilename, previewSrc） |
| 子元件拆分 | ✅ 合規 | `EditorPreview` + `EditorInfoPanel` |
| 無頭 UI 工廠函數 | ❌ 不合規 | 兩個元件皆無 `.svelte.ts` |
| Store 模式 | ⚠️ 非標準 | Module-level singleton stores |

### 主要問題

1. **缺少無頭 UI**：`EditorInfoPanel.svelte` 直接 import stores 並在模板中使用。`EditorPreview.svelte` 有 zoom/pan 邏輯但依賴共用 `useZoomPan`。
2. **`+page.svelte` 含衍生狀態**：`previewFilename` 與 `previewSrc` 應在子元件或無頭 UI 中計算。
3. **auto-save `$effect` 在頁面層**：監聽 `editStore.dirty` → `debouncedSave()`，應移至子元件或無頭 UI。

---

## 二、重構目標

1. 為 `EditorPreview` 和 `EditorInfoPanel` 補齊無頭 UI。
2. 將 `+page.svelte` 中的衍生狀態與 auto-save 邏輯移入無頭 UI 或子元件。

---

## 三、目標檔案結構

```
src/routes/editor/[id]/
├── +page.server.ts           ← 不變
├── +page.svelte              ← 瘦身：移除 $derived、$effect
├── stores.svelte.ts          ← 不變
├── actions.ts                ← 不變
├── EditorPreview.svelte      ← 瘦身
├── editorPreview.svelte.ts   ← 新增：previewSrc 衍生 + zoom reset
├── EditorInfoPanel.svelte    ← 瘦身
└── editorInfoPanel.svelte.ts ← 新增：image 衍生 + dirty 標記
```

---

## 四、各無頭 UI 設計

### 4.1 `editorPreview.svelte.ts`

```ts
import { editStore } from "./stores.svelte.js";
import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

export function createEditorPreview() {
  const zp = useZoomPan();

  let previewFilename = $derived(
    editStore.image ? editStore.image.id + editStore.image.ext : null
  );
  let previewSrc = $derived(
    previewFilename ? `/img/committed/${previewFilename}` : ""
  );

  // Reset zoom when image changes
  $effect(() => {
    previewSrc; // track
    zp.reset();
  });

  return {
    get previewFilename() { return previewFilename; },
    get previewSrc() { return previewSrc; },
    zp,
  };
}
```

### 4.2 `editorInfoPanel.svelte.ts`

```ts
import { editStore } from "./stores.svelte.js";
import { markDirty } from "./actions.js";

export function createEditorInfoPanel() {
  let image = $derived(editStore.image!);

  return {
    get image() { return image; },
    handleDirty: markDirty,
  };
}
```

### 4.3 auto-save 邏輯遷移

目前 `+page.svelte` 中的 auto-save `$effect`：

```ts
$effect(() => {
  if (editStore.dirty) debouncedSave();
});
```

**建議**：移至 `editorPreview.svelte.ts` 或新增獨立的 `editorAutoSave.svelte.ts`。因為 auto-save 是頁面級行為而非特定元件的，較合理的做法是在 `+page.svelte` 仍保留此單一 `$effect`（僅此一行），或封裝為 `initAutoSave()` 放在 `actions.ts` 中由 `initEdit` 呼叫。

**推薦**：保留在 `+page.svelte`，因為它僅一行且確實是頁面層關注點（何時自動存檔）。

---

## 五、注意事項

- `+page.server.ts` 與 `actions.ts` 不需修改。
- `EditorPreview` 與 `TaggerPreview` 的 zoom/pan 行為幾乎一致，共用 `useZoomPan` 即可，不必額外抽象。
- `previewFilename` 與 `previewSrc` 的 `$derived` 移入 `editorPreview.svelte.ts` 後，`+page.svelte` 不再需要這兩個值。
