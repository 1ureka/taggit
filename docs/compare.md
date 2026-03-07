# 重構計畫 — `/compare`（比較頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/compare/
├── +page.server.ts   ← SSR：queryImages(random, limit=2)
└── +page.svelte      ← 比較頁全部 UI + 邏輯 + 樣式（~250 行）
```

共 **2 個檔案**。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ❌ 不合規 | 包含全部業務邏輯（loadPair、filter 狀態、keyboard handler） |
| 子元件拆分 | ❌ 不合規 | 無子元件 |
| 無頭 UI 工廠函數 | ❌ 不合規 | 無 `.svelte.ts` |

### 主要問題

1. **所有邏輯集中在 `+page.svelte`**：
   - 6 個 `$state`（filterTags, filterMinRating, totalCount, pairA, pairB, loading, showLoading, errorMsg）
   - `$effect` 監聽篩選變動觸發 `loadPair()`
   - `loadPair()` 非同步函式
   - `openInEditor()` 導航
   - `handleKeydown` 鍵盤快捷鍵
2. **無子元件委託**：所有 HTML 模板直接在頁面層。

---

## 二、重構目標

將全部 UI 抽至 `CompareView.svelte` + `compareView.svelte.ts`，頁面層僅做資料銜接。

---

## 三、目標檔案結構

```
src/routes/compare/
├── +page.server.ts           ← 不變
├── +page.svelte              ← 僅接收 data，渲染 <CompareView>
├── CompareView.svelte        ← 比較 UI（header + 兩張卡片 + footer）
└── compareView.svelte.ts     ← 比較邏輯（篩選狀態、loadPair、keyboard）
```

---

## 四、各檔案職責

### 4.1 `+page.svelte`

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import CompareView from "./CompareView.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Compare — Image Manager</title>
</svelte:head>

<CompareView
  initialPairA={data.pairA}
  initialPairB={data.pairB}
  initialTotal={data.total}
/>
```

### 4.2 `compareView.svelte.ts`

```ts
import type { ImageWithId, QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";

type CompareOptions = {
  initialPairA: ImageWithId | null;
  initialPairB: ImageWithId | null;
  initialTotal: number;
};

export function createCompareView(options: CompareOptions) {
  let filterTags = $state<string[]>([]);
  let filterMinRating = $state(0);
  let totalCount = $state(options.initialTotal);
  let pairA = $state<ImageWithId | null>(options.initialPairA);
  let pairB = $state<ImageWithId | null>(options.initialPairB);
  let loading = $state(false);
  let showLoading = $state(false);
  let errorMsg = $state(options.initialPairA ? "" : "圖片不足兩張");

  const LOADING_DELAY = 200;
  let loadingTimer: ReturnType<typeof setTimeout> | null = null;
  let filterMounted = false;

  // 監聽篩選條件變動
  $effect(() => {
    filterTags;
    filterMinRating;
    if (!filterMounted) {
      filterMounted = true;
      return;
    }
    loadPair();
  });

  async function loadPair() { /* ... */ }

  function openInEditor(img: ImageWithId | null) {
    if (img) window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === " ") {
      e.preventDefault();
      loadPair();
    }
  }

  return {
    get filterTags() { return filterTags; },
    set filterTags(v) { filterTags = v; },
    get filterMinRating() { return filterMinRating; },
    set filterMinRating(v) { filterMinRating = v; },
    get totalCount() { return totalCount; },
    get pairA() { return pairA; },
    get pairB() { return pairB; },
    get loading() { return loading; },
    get showLoading() { return showLoading; },
    get errorMsg() { return errorMsg; },
    loadPair,
    openInEditor,
    handleKeydown,
  };
}
```

### 4.3 `CompareView.svelte`

- 接收 `initialPairA`, `initialPairB`, `initialTotal` props。
- 呼叫 `createCompareView({ ... })`。
- 搬入原 `+page.svelte` 的全部 HTML 模板與 `<style>`。
- `<svelte:window onkeydown={ui.handleKeydown} />`

---

## 五、注意事項

- `+page.server.ts` 不需修改。
- 無跨元件共享狀態，不需 Context。
- 此頁面的 `$effect` 用於監聽篩選變動 → `loadPair()`，移入無頭 UI 後行為不變。
