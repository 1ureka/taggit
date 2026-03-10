# `/scroll` 路由 URL Query Params 遷移計畫

> 將 `/scroll` 的篩選狀態從 `ScrollContext`（`$state`）遷移為 URL query params 驅動，同時依據 `docs/frontend.md` 規範移除 Context，改以 props / `bind` 傳遞狀態。

---

## 一、現況分析

### 1.1 目前架構

```
+page.server.ts          SSR 查詢：無篩選、回傳全量圖片
+page.svelte             建立 ScrollContext，注入 data，組裝子元件
context.svelte.ts        ScrollContext class（createContext）
ScrollForm.svelte         getScrollContext() 讀寫篩選狀態
  scrollForm.svelte.ts    doSearch() client-side API 呼叫
ScrollMasonry.svelte      getScrollContext() 讀取 items/columns
  scrollMasonry.svelte.ts getScrollContext() 讀取 items/columns/pageContentEl
ScrollFab.svelte          getScrollContext() 讀取 pageContentEl
  scrollFab.svelte.ts     getScrollContext() 監聽 scrollTop
```

### 1.2 問題

1. **使用了 `createContext`**：違反 `frontend.md` §1.2 「不使用 Context」規範。所有子元件透過 `getScrollContext()` 存取共享狀態，應改為 props / `bind`。
2. **SSR 載入全量資料**：`+page.server.ts` 執行 `queryImages(db, { sort: "committedAt", order: "desc" })`，不帶篩選條件，首次載入資料量過大。
3. **篩選由 client API 驅動**：`scrollForm.svelte.ts` 的 `doSearch()` 以 `api.get('/api/images?...')` 取得篩選結果，無法利用 SvelteKit 的 SSR 與 `invalidateAll` 機制。
4. **F5 / 返回鍵遺失狀態**：篩選條件存於記憶體 `$state`，重整或瀏覽器返回後歸零。

---

## 二、遷移目標

| 項目 | 遷移前 | 遷移後 |
| --- | --- | --- |
| 篩選狀態來源 | `ScrollContext` (`$state`) | URL query params |
| 資料來源 | SSR 全量 + client API 篩選 | SSR 依 URL params 查詢 |
| 跨元件傳遞 | `createContext` / `getScrollContext` | props / `bind` |
| 重整/返回 | 狀態遺失 | URL 自動恢復 |
| `columns` | `ScrollContext` `$state` | `+page.svelte` `$state`（UI 偏好不入 URL） |
| `pageContentEl` | `ScrollContext` `$state` | `+page.svelte` 傳 prop |

---

## 三、URL 參數設計

沿用 `$lib/utils.ts` 的 `parseQueryParams()` / `buildQueryString()`，格式與 `/editor` 一致：

```
/scroll?tags=landscape,nature&rating=4&ratingOp=gte&sort=committedAt&order=desc
```

| 參數 | 預設值 | 省略條件 |
| --- | --- | --- |
| `tags` | `[]`（空） | 無選擇時省略 |
| `rating` | `undefined` | 未設定時省略 |
| `ratingOp` | `gte` | 為 `gte` 時省略 |
| `sort` | `committedAt` | 為 `committedAt` 時省略 |
| `order` | `desc` | 為 `desc` 時省略 |

**不入 URL 的狀態**：`columns`（UI 偏好，由元件內部 breakpoint 偵測初始化，使用者可手動調整）。

---

## 四、逐檔改動計畫

### 4.1 刪除 `context.svelte.ts`

整個檔案刪除。`ScrollContext` class 與 `createContext` 將被 props / `bind` 取代。

### 4.2 `+page.server.ts` — SSR 依 URL 查詢

**改動**：從 URL 讀取篩選條件，傳入 `queryImages`。由於 scroll 為不分頁的瀑布流，不設 `limit`（回傳全量）。

```ts
import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { requireDatabase } from "$lib/server/helpers.js";
import { parseQueryParams } from "$lib/utils.js";

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const result = queryImages(loaded.db, parseQueryParams(url));
  return { items: result.items, total: result.total };
};
```

### 4.3 `+page.svelte` — 頁面殼重構

**職責**：接收 SSR `data`，宣告頁面級 `$state`（`columns`、`pageContentEl`），組裝子元件並以 props / `bind` 傳遞。

**主要改動**：

1. 移除 `ScrollContext` 與 `setScrollContext` 的匯入及使用
2. 移除 `proxy` 物件（不再需要手動同步 data → context）
3. 以 `$state` 宣告 `columns` 和 `pageContentEl`
4. `data.items`、`data.total` 直接透過 props 傳給子元件（SvelteKit 的 `data` 自身是響應式的）
5. 保留 `columnOptions` 和 `Select` 元件（`columns` 綁定至本地 `$state`）

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import Select from "$lib/components/Select.svelte";
  import ScrollFab from "./ScrollFab.svelte";
  import ScrollForm from "./ScrollForm.svelte";
  import ScrollMasonry from "./ScrollMasonry.svelte";

  let { data }: { data: PageData } = $props();

  let columns = $state(3);
  let pageContentEl = $state<HTMLElement | null>(null);

  const columnOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
    value: n,
    label: `${n} 欄`,
  }));
</script>

<svelte:head>
  <title>Scroll — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">垂直瀏覽</span>
    <div class="select-wrapper">
      <Select bind:value={columns} options={columnOptions} />
    </div>
  </header>

  <main class="page-content slide-up" bind:this={pageContentEl}>
    <ScrollForm total={data.total} />
    <ScrollMasonry items={data.items} {columns} {pageContentEl} />
  </main>
</div>

<ScrollFab {pageContentEl} />
```

### 4.4 `scrollForm.svelte.ts` — 篩選 → URL 導航

**改動**：將原本的 client API 呼叫 (`doSearch`) 替換為 `goto()` URL 導航，模式與 editor 的 `editorForm.svelte.ts` 一致。

1. 從 `page.url` 以 `parseQueryParams()` 初始化所有篩選 `$state`
2. 篩選變更時透過 `buildQueryString()` 組裝 query string，以 `goto()` 導航（觸發 SSR `load` 重跑）
3. 以 `afterNavigate({ type: "popstate" })` 監聽瀏覽器返回，從 URL 同步篩選值
4. 不再匯入 `getScrollContext`、`api`、`addToast`

```ts
import { goto, afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";

export function createScrollForm() {
  const init = parseQueryParams(page.url);

  let selectedTags = $state<string[]>(init.tags ?? []);
  let rating = $state<number | undefined>(init.rating);
  let ratingOp = $state<"gte" | "lte" | "eq">(init.ratingOp ?? "gte");
  let sort = $state<"committedAt" | "rating" | "name" | "random">(init.sort ?? "committedAt");
  let order = $state<"asc" | "desc">(init.order ?? "desc");

  afterNavigate(({ type }) => {
    if (type === "popstate") {
      const vals = parseQueryParams(page.url);
      selectedTags = vals.tags ?? [];
      rating = vals.rating;
      ratingOp = vals.ratingOp ?? "gte";
      sort = vals.sort ?? "committedAt";
      order = vals.order ?? "desc";
    }
  });

  function currentQueryString(): string {
    return buildQueryString({ tags: selectedTags, rating, ratingOp, sort, order });
  }

  function handleFilterChange() {
    goto(`/scroll${currentQueryString()}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  return {
    get selectedTags() { return selectedTags; },
    set selectedTags(v: string[]) { selectedTags = v; },
    get rating() { return rating; },
    set rating(v: number | undefined) { rating = v; },
    get ratingOp() { return ratingOp; },
    set ratingOp(v: "gte" | "lte" | "eq") { ratingOp = v; },
    get sort() { return sort; },
    set sort(v: "committedAt" | "rating" | "name" | "random") { sort = v; },
    get order() { return order; },
    set order(v: "asc" | "desc") { order = v; },
    handleFilterChange,
  };
}
```

### 4.5 `ScrollForm.svelte` — 接收 `total` 為 prop

**改動**：

1. 移除 `getScrollContext` 匯入
2. 不再從 context 讀取 `selectedTags`、`rating` 等——改為直接綁定 `createScrollForm()` 回傳的 `ui` 物件
3. `total` 改為由 `+page.svelte` 透過 prop 傳入（SSR data 驅動）

```svelte
<script lang="ts">
  import FilterBar from "$lib/components/FilterBar.svelte";
  import { createScrollForm } from "./scrollForm.svelte.js";

  let { total }: { total: number } = $props();
  const ui = createScrollForm();
</script>

<div class="scroll-filter-area">
  <FilterBar
    bind:selectedTags={ui.selectedTags}
    bind:rating={ui.rating}
    bind:ratingOp={ui.ratingOp}
    bind:sort={ui.sort}
    bind:order={ui.order}
    onchange={ui.handleFilterChange}
  />
  <div class="scroll-result-count">
    <span>{total} 張結果</span>
  </div>
</div>
```

### 4.6 `scrollMasonry.svelte.ts` — 改為 options 接收 props

**改動**：

1. 移除 `getScrollContext` 匯入
2. 接收 `items`、`columns`、`pageContentEl` 為 getter-based options（符合 `frontend.md` §1.3 無頭 UI 接收 props 規範）
3. `detectBreakpoint` 改為回傳值而非直接寫入 context，讓 `+page.svelte` 的 `columns` 初始化可由 `onMount` 或移至此處處理

```ts
type ScrollMasonryOptions = {
  items: ImageWithId[];
  columns: number;
  pageContentEl: HTMLElement | null;
};

export function createScrollMasonry(options: ScrollMasonryOptions) {
  let containerEl = $state<HTMLElement | null>(null);

  const layout = $derived(createWeightBasedLayout(options.items, options.columns));

  const virtualizer = createVirtualizer(
    () => layout,
    () => containerEl,
    () => options.pageContentEl,
  );

  // ... detectBreakpoint / handleImageDblClick 不變
}
```

### 4.7 `ScrollMasonry.svelte` — 接收 props 取代 context

**改動**：

1. 移除 `getScrollContext` 匯入
2. 宣告 Props 接收 `items`、`columns`、`pageContentEl`
3. 將 `$props()` 以 getter-based options 傳入 `createScrollMasonry()`
4. `loading` 狀態：遷移後由 SvelteKit 的 `navigating` store 驅動（見 §4.9），改為 prop 或元件自行讀取 `navigating`

```svelte
<script lang="ts">
  import { navigating } from "$app/state";
  import type { ImageWithId } from "$lib/types.js";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { createScrollMasonry } from "./scrollMasonry.svelte.js";

  type Props = {
    items: ImageWithId[];
    columns: number;
    pageContentEl: HTMLElement | null;
  };

  let { items, columns, pageContentEl }: Props = $props();

  const ui = createScrollMasonry({
    get items() { return items; },
    get columns() { return columns; },
    get pageContentEl() { return pageContentEl; },
  });
</script>

{#if items.length === 0 && !navigating}
  <div class="scroll-empty">找不到符合的圖片</div>
{/if}

<!-- masonry 模板不變，使用 ui.containerEl / ui.visibleItems / ui.totalHeight -->

{#if navigating}
  <div class="scroll-loading">載入中…</div>
{/if}
```

### 4.8 `scrollFab.svelte.ts` — 改為 options 接收 `pageContentEl`

**改動**：

1. 移除 `getScrollContext` 匯入
2. 接收 `pageContentEl` 為 getter-based option

```ts
type ScrollFabOptions = {
  pageContentEl: HTMLElement | null;
};

export function createScrollFab(options: ScrollFabOptions) {
  let showFab = $state(false);

  $effect(() => {
    const el = options.pageContentEl;
    if (!el) return;
    const onScroll = throttle(() => { showFab = el.scrollTop > 300; }, 150);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  function handleFabClick() {
    options.pageContentEl?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return {
    get showFab() { return showFab; },
    handleFabClick,
  };
}
```

### 4.9 `ScrollFab.svelte` — 接收 `pageContentEl` 為 prop

```svelte
<script lang="ts">
  import { IconArrowUp } from "@tabler/icons-svelte";
  import { fly } from "svelte/transition";
  import { createScrollFab } from "./scrollFab.svelte.js";

  let { pageContentEl }: { pageContentEl: HTMLElement | null } = $props();

  const ui = createScrollFab({
    get pageContentEl() { return pageContentEl; },
  });
</script>
<!-- 模板不變 -->
```

---

## 五、載入狀態處理

**遷移前**：`ctx.loading` 由 `doSearch()` 手動設置 `true`/`false`。

**遷移後**：篩選變更觸發 `goto()` → SvelteKit 重跑 `load` → `data` 自動更新。載入期間的 pending 狀態改用 SvelteKit 內建的 `navigating` store：

```svelte
import { navigating } from "$app/state";
<!-- navigating 為 truthy 時表示正在導航（即正在載入） -->
{#if navigating}
  <div class="scroll-loading">載入中…</div>
{/if}
```

這移除了手動管理 `loading` 狀態的需求。

---

## 六、`columns` 初始化策略

`columns` 不入 URL，保留為 UI 偏好狀態。

`scrollMasonry.svelte.ts` 現有的 `detectBreakpoint()` 在 `onMount` 時依瀏覽器寬度設定初始欄數（需改為 setter callback 或由 `+page.svelte` 處理）。

建議維持 `detectBreakpoint` 在 `scrollMasonry.svelte.ts` 中，但透過 options 的 setter 回寫：

```ts
type ScrollMasonryOptions = {
  // ...
  columns: number;  // getter + setter
};

// onMount 中：
onMount(() => {
  const cols = detectBreakpoint();
  options.columns = cols;  // 透過 setter 回寫至 +page.svelte 的 $state
});
```

`+page.svelte` 傳入時以 `bind:` 或 getter/setter 形式：

```svelte
<ScrollMasonry items={data.items} bind:columns {pageContentEl} />
```

---

## 七、遷移後檔案結構

```
+page.server.ts          SSR：parseQueryParams(url) → queryImages
+page.svelte             接收 data，宣告 columns/$state，props 傳遞
ScrollForm.svelte         接收 total prop，綁定 createScrollForm 的篩選狀態
  scrollForm.svelte.ts    URL 初始化 + goto() 導航 + popstate 同步
ScrollMasonry.svelte      接收 items/columns/pageContentEl props
  scrollMasonry.svelte.ts 接收 options，佈局/虛擬化邏輯不變
ScrollFab.svelte          接收 pageContentEl prop
  scrollFab.svelte.ts     接收 options，監聽 scrollTop
masonry/                  不改動
```

**刪除**：`context.svelte.ts`

---

## 八、注意事項

1. **`noScroll: true`**：`goto()` 時必須設定，避免篩選變更後瀑布流自動捲回頂部。
2. **`replaceState: true`**：篩選變更使用 `replaceState`，避免每次調整都產生歷史記錄。翻頁不適用此頁面（無分頁）。
3. **`keepFocus: true`**：維持使用者焦點，避免 `goto()` 導航後焦點跳離。
4. **masonry 子資料夾不改動**：`masonry-layout.ts`、`raf-aggregator.ts`、`virtualizer.svelte.ts` 為純邏輯模組，不依賴 Context，無需改動。
5. **全量載入**：此路由為瀑布流無限捲動，不使用分頁，SSR 查詢時不設 `limit`。這與 `/editor`（`limit: 30`）不同。
6. **JSDoc**：所有新增/修改的 `$state`、handler、return 成員須依 `frontend.md` §2.7 規範撰寫 JSDoc。
7. **程式碼編排**：工廠函數內部依 `frontend.md` §2.6 段落順序排列：`$state` → `$derived` → 常數 → private helpers → handlers → `$effect` → return。
