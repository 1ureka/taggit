# 重構計畫 — `/tagger`

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/tagger/
├── +page.server.ts            ← SSR：getStagedFiles
├── +page.svelte               ← 頁面殼：initTagger + 組裝子元件
├── stores.svelte.ts           ← 5 個 module-level store class
├── actions.ts                 ← 所有業務邏輯（mutation stores 的唯一入口）
├── helpers.ts                 ← 純工具函式（stagedUrl, imageDimensions, batchRun）
├── TaggerHeader.svelte        ← 頂部進度列 + 工具按鈕
├── TaggerSidebar.svelte       ← 左側檔案列表（虛擬滾動）
├── TaggerPreview.svelte       ← 中間預覽區（zoom/pan）
├── TaggerTagPanel.svelte      ← 右側標籤面板（rating + autocomplete + 操作按鈕）
├── TaggerModalTools.svelte    ← 工具 Modal
└── TaggerModalRename.svelte   ← 標籤重命名 Modal
```

共 **11 個檔案**，結構清晰。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ✅ 合規 | 僅 `initTagger` + 組裝四個子元件 + viewport guard |
| 子元件拆分 | ⚠️ 部分合規 | 子元件皆有 `.svelte`，但**沒有**對應的 `.svelte.ts` 無頭 UI 檔案 |
| 無頭 UI 工廠函數 | ❌ 不合規 | 所有元件的邏輯直接寫在 `.svelte` 的 `<script>` 中 |
| Store 模式 | ⚠️ 非標準 | 使用 module-level singleton stores 而非 Context API |

### 主要問題

1. **缺少無頭 UI**：`TaggerSidebar.svelte` 包含虛擬列表計算、scroll 追蹤、ResizeObserver 等邏輯，應抽至 `taggerSidebar.svelte.ts`。其餘子元件同理。
2. **Module-level stores**：`stores.svelte.ts` 定義了 5 個 module-level singleton（`fileStore`, `selectionStore`, `editStore`, `uiStore`, `toolStore`）。此模式在 Tagger 頁面是可行的（僅單一頁面消費），但不符合 Context API 規範。
3. **`actions.ts` 直接 import stores**：actions 直接讀寫 module-level stores，若改用 Context 則需調整為接收 context 參數或改為 class method。

---

## 二、重構方向

### 2.1 最小破壞性路線（推薦）

保留 `stores + actions` 分離模式（因為 Tagger 是單頁消費，module-level singleton 不會造成問題），但補齊每個子元件的無頭 UI。

### 2.2 補齊無頭 UI

| 元件 | 需新增的無頭 UI | 要抽出的邏輯 |
|------|-----------------|-------------|
| `TaggerHeader` | `taggerHeader.svelte.ts` | `$derived` 進度計算（processed, progressPct, progressLabel） |
| `TaggerSidebar` | `taggerSidebar.svelte.ts` | 虛擬列表常量 & 計算（ITEM_H, BUFFER, scrollTop, viewH, totalH, startIdx, endIdx, visible）、ResizeObserver 管理、scroll-into-view 邏輯、click handler |
| `TaggerPreview` | `taggerPreview.svelte.ts` | `$derived`（currentFile, previewSrc, selectedCount）、zoom reset 邏輯 |
| `TaggerTagPanel` | `taggerTagPanel.svelte.ts` | focus-input `$effect` 邏輯、`$derived` selectedCount |
| `TaggerModalTools` | `taggerModalTools.svelte.ts` | 極簡，可省略（Modal 無複雜狀態，僅觸發 actions） |
| `TaggerModalRename` | `taggerModalRename.svelte.ts` | 本地表單狀態（selectedTags, oldName, newName）、handleSelectChange、handleSubmit、handleKeydown |

---

## 三、目標檔案結構

```
src/routes/tagger/
├── +page.server.ts               ← 不變
├── +page.svelte                   ← 不變（已合規）
├── stores.svelte.ts               ← 不變（保持 module-level singleton）
├── actions.ts                     ← 不變
├── helpers.ts                     ← 不變
├── TaggerHeader.svelte            ← 瘦身：script 僅呼叫 createTaggerHeader
├── taggerHeader.svelte.ts         ← 新增：進度相關 derived
├── TaggerSidebar.svelte           ← 瘦身：script 僅呼叫 createTaggerSidebar
├── taggerSidebar.svelte.ts        ← 新增：虛擬列表 + scroll 邏輯
├── TaggerPreview.svelte           ← 瘦身
├── taggerPreview.svelte.ts        ← 新增：derived 狀態 + zoom reset
├── TaggerTagPanel.svelte          ← 瘦身
├── taggerTagPanel.svelte.ts       ← 新增：focus 邏輯 + derived
├── TaggerModalTools.svelte        ← 可保持原樣（邏輯極少）
├── TaggerModalRename.svelte       ← 瘦身
└── taggerModalRename.svelte.ts    ← 新增：表單狀態 + 驗證
```

---

## 四、各無頭 UI 工廠函數設計

### 4.1 `taggerHeader.svelte.ts`

```ts
export function createTaggerHeader() {
  let processed = $derived(fileStore.total - fileStore.list.length);
  let progressPct = $derived(fileStore.total > 0 ? Math.round((processed / fileStore.total) * 100) : 0);
  let progressLabel = $derived(`${processed}/${fileStore.total} (${fileStore.list.length} 剩餘)`);

  return {
    get processed() { return processed; },
    get progressPct() { return progressPct; },
    get progressLabel() { return progressLabel; },
  };
}
```

### 4.2 `taggerSidebar.svelte.ts`

```ts
type SidebarOptions = {
  listEl: HTMLDivElement | undefined;
};

export function createTaggerSidebar(options: SidebarOptions) {
  // 虛擬列表常量
  const ITEM_H = 72;
  const BUFFER = 5;

  // 狀態
  let scrollTop = $state(0);
  let viewH = $state(400);

  // Derived
  let totalH = $derived(fileStore.list.length * ITEM_H);
  let startIdx = $derived(Math.max(0, Math.floor(scrollTop / ITEM_H) - BUFFER));
  let endIdx = $derived(Math.min(fileStore.list.length, Math.ceil((scrollTop + viewH) / ITEM_H) + BUFFER));
  let visible = $derived(/* ... */);

  // ResizeObserver、scroll-into-view、handleClick ...

  return { /* getters + handlers */ };
}
```

### 4.3 `taggerModalRename.svelte.ts`

```ts
export function createTaggerModalRename() {
  let selectedTags = $state<string[]>([]);
  let oldName = $derived.by(() => selectedTags[0] ?? "");
  let newName = $state("");

  function handleSelectChange() { /* ... */ }
  function handleSubmit() { /* ... */ }
  function handleKeydown(e: KeyboardEvent) { /* ... */ }

  return {
    get selectedTags() { return selectedTags; },
    set selectedTags(v) { selectedTags = v; },
    get oldName() { return oldName; },
    get newName() { return newName; },
    set newName(v) { newName = v; },
    get canSubmit() { /* ... */ },
    handleSelectChange,
    handleSubmit,
    handleKeydown,
  };
}
```

---

## 五、關於 Context vs Module-level Stores

### 為何暫不遷移至 Context

1. Tagger 是**單一路由**消費這些 stores，不存在多實例問題。
2. `actions.ts` 大量直接 import stores，遷移至 Context 需將所有 action 改為接收 context 參數，破壞面大。
3. Tagger 的 `stores + actions` 分離模式在該頁面內運作良好，且子元件已經正確委託。

### 若未來需遷移至 Context

1. 將 5 個 store class 合併為一個 `TaggerContext` class。
2. 在 `+page.svelte` 中 `setTaggerContext(new TaggerContext())`。
3. 子元件以 `getTaggerContext()` 取得。
4. `actions.ts` 改為接收 context 參數的函式，或改為 context class 的 method。

---

## 六、注意事項

- `+page.server.ts` 不需修改。
- `helpers.ts` 中的 `imageDimensions` 待 sharp 引入後可移除（見 sharp2.md）。
- Modal 元件（`TaggerModalTools`）因邏輯極簡，可選擇性跳過無頭 UI 拆分。
