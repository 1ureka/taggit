# 重構計畫 — `/scroll`（瀑布流瀏覽頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/scroll/
├── +page.server.ts        ← SSR：queryImages（無分頁，全量載入）
├── +page.svelte           ← 全部 UI + 邏輯 + 樣式（~230 行）
├── masonry.ts             ← 純函式：權重式瀑布流佈局計算 + 虛擬化裁切
└── virtualizer.svelte.ts  ← Svelte 5 響應式虛擬化器（createVirtualizer）
```

共 **4 個檔案**。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ❌ 不合規 | 包含完整業務邏輯（篩選狀態、doSearch、virtualizer 初始化）|
| 子元件拆分 | ❌ 不合規 | 無子元件，所有 UI 在頁面層 |
| 無頭 UI 工廠函數 | ⚠️ 部分合規 | `virtualizer.svelte.ts` 已是工廠函數模式，但頁面本身未抽出 |
| 純函式模組 | ✅ 合規 | `masonry.ts` 是純函式，設計良好 |

### 主要問題

1. **`+page.svelte` 包含全部業務邏輯**：
   - 8 個 `$state`（selectedTags, rating, ratingOp, sort, order, items, total, loading, showFab, columns）
   - `onMount` 中的 breakpoint 計算
   - `doSearch()` 非同步查詢
   - `createVirtualizer` 初始化
   - `handleScroll`, `handleFABClick`, `handleImageDblClick` 事件處理
2. **無子元件委託**：所有 HTML 模板直接在頁面層。

---

## 二、重構目標

將全部 UI 抽至 `ScrollView.svelte` + `scrollView.svelte.ts`，頁面層僅做資料銜接。

---

## 三、目標檔案結構

```
src/routes/scroll/
├── +page.server.ts           ← 不變
├── +page.svelte              ← 僅接收 data，渲染 <ScrollView>
├── ScrollView.svelte         ← 瀑布流 UI（header + 篩選 + 瀑布流 + FAB）
├── scrollView.svelte.ts      ← 頁面邏輯（篩選狀態、搜尋、column breakpoint）
├── masonry.ts                ← 不變（純函式）
└── virtualizer.svelte.ts     ← 不變（已合規）
```

---

## 四、各檔案職責

### 4.1 `+page.svelte`

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import ScrollView from "./ScrollView.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Scroll — Image Manager</title>
</svelte:head>

<ScrollView initialItems={data.initialItems} initialTotal={data.initialTotal} />
```

### 4.2 `scrollView.svelte.ts`

```ts
import type { ImageWithId, QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import { throttle } from "$lib/utils.js";
import { createWeightBasedLayout } from "./masonry.js";
import { createVirtualizer } from "./virtualizer.svelte.js";

type ScrollViewOptions = {
  initialItems: ImageWithId[];
  initialTotal: number;
  // DOM ref getters（由 .svelte 提供）
  containerEl: HTMLElement | null;
  pageContentEl: HTMLElement | null;
};

export function createScrollView(options: ScrollViewOptions) {
  const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6].map(n => ({ value: n, label: `${n} 欄` }));

  // 篩選狀態
  let selectedTags = $state<string[]>([]);
  let rating = $state<number | undefined>(undefined);
  let ratingOp = $state<"gte" | "lte" | "eq">("gte");
  let sort = $state("committedAt");
  let order = $state("desc");

  // 資料狀態
  let items = $state<ImageWithId[]>(options.initialItems);
  let total = $state(options.initialTotal);
  let loading = $state(false);
  let showFab = $state(false);
  let columns = $state(3);

  // Layout
  let layout = $derived(createWeightBasedLayout(items, columns));

  // Virtualizer
  const virtualizer = createVirtualizer(
    () => layout,
    () => options.containerEl,
    () => options.pageContentEl,
  );

  async function doSearch() { /* ... */ }

  const handleScroll = throttle(() => { /* ... */ }, 150);

  function handleFABClick() { /* ... */ }

  function handleImageDblClick(img: ImageWithId) {
    window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
  }

  function initColumns() {
    const breakpoints = [
      { width: 1600, cols: 6 },
      { width: 1200, cols: 5 },
      { width: 900, cols: 4 },
      { width: 600, cols: 2 },
      { width: 0, cols: 1 },
    ];
    columns = breakpoints.find(b => window.innerWidth >= b.width)?.cols ?? 3;
  }

  return {
    // 篩選狀態 getters/setters
    get selectedTags() { return selectedTags; },
    set selectedTags(v) { selectedTags = v; },
    get rating() { return rating; },
    set rating(v) { rating = v; },
    get ratingOp() { return ratingOp; },
    set ratingOp(v) { ratingOp = v; },
    get sort() { return sort; },
    set sort(v) { sort = v; },
    get order() { return order; },
    set order(v) { order = v; },
    get columns() { return columns; },
    set columns(v) { columns = v; },

    // 資料狀態
    get items() { return items; },
    get total() { return total; },
    get loading() { return loading; },
    get showFab() { return showFab; },

    // 衍生
    get COLUMN_OPTIONS() { return COLUMN_OPTIONS; },
    virtualizer,

    // 方法
    doSearch,
    handleScroll,
    handleFABClick,
    handleImageDblClick,
    initColumns,
  };
}
```

### 4.3 `ScrollView.svelte`

- 接收 `initialItems` 與 `initialTotal` props。
- 宣告 DOM ref `$state`（`containerEl`, `pageContentEl`），以 getter 傳入工廠函數。
- 在 `onMount` 中呼叫 `ui.initColumns()`。
- 搬入原 `+page.svelte` 的所有 HTML 模板與 `<style>`。

---

## 五、注意事項

- `+page.server.ts` 不需修改。
- `masonry.ts` 與 `virtualizer.svelte.ts` 已是良好的純函式 / 工廠函數模組，不需改動。
- `createVirtualizer` 內部使用 `$effect`，必須在元件初始化階段（同步 script）呼叫，所以 `createScrollView` 也必須在同步 script 中呼叫。
- 無跨元件共享狀態，不需 Context。
