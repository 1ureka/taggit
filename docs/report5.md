# `/editor` URL 化改造 — 實作計畫

> URL 即 source of truth。Context 瘦身為結果 + 純 UI 狀態。三份重複 `doSearch()` 全部消除。

---

## 一、架構變更總覽

### Before

```
使用者改篩選 → ctx 更新 → doSearch() → API call → ctx 結果更新
                ctx 持有: searchText, selectedTags, rating, ratingOp, sort, order,
                          items, total, page, pages, loading, showLoading, selected

三處各 copy 一份 doSearch()（editorForm / editorPagination / editorSelectionDock）
```

### After

```
使用者改篩選 → editorForm local state 更新 → goto(URL) → load(SSR) → data 更新
                                                                         ↓
                                                              $effect → ctx 結果更新

ctx 只持有: items, total, page, pages, selected
loading/showLoading → editorList 內部（唯一消費者）
unified loading → editorSelectionDock 內部（所有操作互斥 + buttons disabled）
篩選狀態 → editorForm 的 local $state（search 可 debounce，其餘立即 goto）
Rating → 從 dock 移除，改為「退回 staged」按鈕（本階段先空殼）
doSearch() → 不再存在
```

---

## 二、URL 格式

```
/editor?search=cat&tags=animal,cute&rating=3&ratingOp=gte&sort=rating&order=desc&page=2
```

| 參數 | 預設值 | 省略規則 |
|------|--------|---------|
| `search` | `""` | 空字串時省略 |
| `tags` | `[]` | 無標籤時省略 |
| `rating` | — | 未設定時省略 |
| `ratingOp` | `"gte"` | 為預設值時省略 |
| `sort` | `"committedAt"` | 為預設值時省略 |
| `order` | `"desc"` | 為預設值時省略 |
| `page` | `1` | 第 1 頁時省略 |

無篩選時 URL 就是 `/editor`。

---

## 三、檔案變更清單

### 3.1 `$lib/utils.ts` — 新增 `buildQueryString()`

```ts
import type { QueryOptions } from "$lib/types.js";

/** 將篩選條件構建為 query string（預設值省略）。為 parseQueryParams 的反向操作。 */
export function buildQueryString(opts: QueryOptions): string {
  const params = new URLSearchParams();
  if (opts.search?.trim()) params.set("search", opts.search.trim());
  if (opts.tags && opts.tags.length > 0) params.set("tags", opts.tags.join(","));
  if (opts.rating !== undefined) {
    params.set("rating", String(opts.rating));
    if (opts.ratingOp && opts.ratingOp !== "gte") params.set("ratingOp", opts.ratingOp);
  }
  if (opts.sort && opts.sort !== "committedAt") params.set("sort", opts.sort);
  if (opts.order && opts.order !== "desc") params.set("order", opts.order);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
```

- 參數型別直接用 `QueryOptions`——與 `parseQueryParams` 對稱
- `URLSearchParams` 在 Node.js（v10+）與瀏覽器皆為全域 API，行為一致
- 放在 `parseQueryParams()` 旁邊，一對 parse/build 讀寫運算
- 未來其他路由（browse、scroll、tagger）URL 化時可直接復用

---

### 3.2 `context.svelte.ts` — 移除所有篩選欄位

```ts
export class EditorContext {
  readonly PAGE_SIZE = 60;

  // ─── 查詢結果（從 data 同步） ────────────────────────
  items = $state<ImageWithId[]>([]);
  total = $state(0);
  page = $state(1);
  pages = $state(1);

  // ─── 選取狀態 ────────────────────────────────────────
  selected = $state<Set<string>>(new Set());
}

// ❌ 移除: searchText, selectedTags, rating, ratingOp, sort, order
// ❌ 移除: loading, showLoading（下放至 editorList）
// ❌ 移除: loadingTimer, searchTimer（各自成為使用處的 local 變數）
// ❌ 移除: LOADING_DELAY, SEARCH_DEBOUNCE（跟隨 timer 下放）
```

---

### 3.3 `+page.server.ts` — 從 URL 查詢

```ts
import { parseQueryParams } from "$lib/utils.js";

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const result = queryImages(loaded.db, { ...parseQueryParams(url), limit: 60 });
  return { result };
};
```

- 復用已有的 `parseQueryParams()`
- 只回傳 `result`，不回傳 `filters`——前端直接從 `page.url` 讀取

---

### 3.4 `+page.svelte` — $effect 同步結果

```svelte
<script lang="ts">
  import { EditorContext, setEditorContext } from "./context.svelte.js";
  import EditorForm from "./EditorForm.svelte";
  import EditorList from "./EditorList.svelte";
  import EditorPagination from "./EditorPagination.svelte";
  import EditorSelectionDock from "./EditorSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  const ctx = setEditorContext(new EditorContext());

  $effect(() => {
    ctx.items = data.result.items;
    ctx.total = data.result.total;
    ctx.page = data.result.page;
    ctx.pages = data.result.pages;
    validateSelection();
  });

  function validateSelection() {
    if (ctx.selected.size === 0) return;
    const visibleIds = new Set(ctx.items.map((i) => i.id));
    const next = new Set([...ctx.selected].filter((id) => visibleIds.has(id)));
    if (next.size !== ctx.selected.size) ctx.selected = next;
  }
</script>

<EditorForm />
<EditorList />
<EditorPagination />
<EditorSelectionDock />
```

- `$effect` 監聽 `data.result` → 自動同步至 ctx（goto、popstate、invalidateAll 所有情境皆覆蓋）
- `validateSelection()` 集中在此，不再散落在三個 doSearch 中
- EditorForm 不接收任何 prop

---

### 3.5 `editorForm.svelte.ts` — 篩選狀態下放為 local $state

```ts
import { goto, afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";
import { getEditorContext } from "./context.svelte.js";

export function createEditorForm() {
  const ctx = getEditorContext();

  // ─── 從 URL 讀取初始值 ──────────────────────────────
  const init = parseQueryParams(page.url);

  // ─── Local filter state ──────────────────────────────
  let searchValue = $state(init.search ?? "");
  let selectedTags = $state<string[]>(init.tags ?? []);
  let rating = $state<number | undefined>(init.rating);
  let ratingOp = $state<"gte" | "lte" | "eq">(init.ratingOp ?? "gte");
  let sort = $state(init.sort ?? "committedAt");
  let order = $state(init.order ?? "desc");

  // ─── Popstate 同步 ──────────────────────────────────
  afterNavigate(({ type }) => {
    if (type === "popstate") {
      const vals = parseQueryParams(page.url);
      searchValue = vals.search ?? "";
      selectedTags = vals.tags ?? [];
      rating = vals.rating;
      ratingOp = vals.ratingOp ?? "gte";
      sort = vals.sort ?? "committedAt";
      order = vals.order ?? "desc";
    }
  });

  // ─── URL 導航 ───────────────────────────────────────
  function currentQueryString(): string {
    return buildQueryString({
      search: searchValue, tags: selectedTags,
      rating, ratingOp, sort, order,
    });
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  const SEARCH_DEBOUNCE = 300;

  function handleSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      goto(`/editor${currentQueryString()}`, { replaceState: true, noScroll: true });
    }, SEARCH_DEBOUNCE);
  }

  function handleFilterChange() {
    goto(`/editor${currentQueryString()}`, { replaceState: true, noScroll: true });
  }

  // ---

  return {
    get searchValue() { return searchValue; },
    set searchValue(v: string) { searchValue = v; },
    get selectedTags() { return selectedTags; },
    set selectedTags(v: string[]) { selectedTags = v; },
    get rating() { return rating; },
    set rating(v: number | undefined) { rating = v; },
    get ratingOp() { return ratingOp; },
    set ratingOp(v: "gte" | "lte" | "eq") { ratingOp = v; },
    get sort() { return sort; },
    set sort(v: string) { sort = v; },
    get order() { return order; },
    set order(v: string) { order = v; },
    handleSearchInput,
    handleFilterChange,
  };
}
```

**差異**：
- ❌ 刪除 `doSearch()`、`validateSelection()`、`import { api }`
- ✅ 改用共用 `parseQueryParams()` 取代自定義 `readURL()`（差異在呼叫端用 `?? ""` 處理）
- ✅ 改用共用 `buildQueryString()` 取代 inline 版本
- ✅ 新增 `afterNavigate` popstate 同步

---

### 3.6 `EditorForm.svelte` — bind 對象從 ctx 改為 ui

```svelte
<script lang="ts">
  import { IconSearch } from "@tabler/icons-svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import { createEditorForm } from "./editorForm.svelte.js";

  const ui = createEditorForm();
</script>

<div class="editor-form">
  <div class="search-input-wrap">
    <span class="search-adornment"><IconSearch size={16} /></span>
    <input
      class="text-input search-input"
      bind:value={ui.searchValue}
      placeholder="搜尋檔名..."
      oninput={ui.handleSearchInput}
      autocomplete="off"
    />
  </div>
  <div class="editor-filters">
    <FilterBar
      bind:selectedTags={ui.selectedTags}
      bind:rating={ui.rating}
      bind:ratingOp={ui.ratingOp}
      bind:sort={ui.sort}
      bind:order={ui.order}
      onchange={ui.handleFilterChange}
    />
  </div>
</div>
```

- ❌ 不再 import / 使用 `getEditorContext`
- ✅ `bind:value` 全改為 `ui.*` 而非 `ctx.*`

---

### 3.7 `editorPagination.svelte.ts` — 大幅簡化

```ts
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { getEditorContext } from "./context.svelte.js";

export function createEditorPagination() {
  const ctx = getEditorContext();

  function handlePageClick(p: number) {
    if (p < 1 || p > ctx.pages) return;
    const params = new URLSearchParams(page.url.searchParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    goto(`/editor${qs ? `?${qs}` : ""}`, { noScroll: true });
  }

  return { handlePageClick };
}
```

- ❌ 刪除 `doSearch()`（~30 行）、`validateSelection()`、`import { api }`
- ✅ 複製當前 URL params → 只改 `page` → `goto()`（完全解耦於篩選邏輯）
- 總行數：~75 行 → ~20 行

---

### 3.8 `editorSelectionDock.svelte.ts` — 移除 Rating、unified loading

```ts
import { invalidateAll } from "$app/navigation";

export function createEditorSelectionDock() {
  const ctx = getEditorContext();

  // ❌ 刪除 doSearch()（~30 行）
  // ❌ 刪除 handleRatingChange()（~25 行）

  // ─── Unified Loading ─────────────────────────────────
  // 所有非同步操作共用，loading 時：
  //   1. 操作函式 early return → 防止重複提交
  //   2. button disabled={ui.loading} → 視覺回饋
  // 比改造前更安全：改造前各操作之間沒有互鎖。
  let loading = $state(false);

  async function handleDeleteClick() {
    if (loading) return;
    loading = true;
    try {
      // ...批次刪除 API 呼叫（不變）...
      clearSelection();
      await invalidateAll();
      // ...toast（不變）...
    } finally {
      loading = false;
    }
  }

  async function handleUnstageClick() {
    // 本階段先空殼，實際功能見「七、退回 staged 功能規劃」
  }

  return {
    get loading() { return loading; },
    handleDeleteClick,
    handleUnstageClick,
    // ...
  };
}
```

---

### 3.9 `EditorSelectionDock.svelte` — 移除 Rating，新增退回按鈕

```svelte
<script lang="ts">
  import { IconTrash, IconArrowBackUp } from "@tabler/icons-svelte";
  import SelectionDock from "$lib/components/SelectionDock.svelte";
  import { createEditorSelectionDock } from "./editorSelectionDock.svelte.js";

  const ui = createEditorSelectionDock();
  // ❌ 移除 dockRating $state 及其 reset $effect
</script>

<SelectionDock count={ui.count} onclose={ui.handleCloseClick}>
  <button class="btn btn-sm" disabled={ui.loading} onclick={ui.handleUnstageClick}>
    <IconArrowBackUp size={14} />
    退回
  </button>

  <div class="dock-separator"></div>

  <button class="btn btn-destructive btn-sm" disabled={ui.loading} onclick={ui.handleDeleteClick}>
    <IconTrash size={14} />
    刪除
  </button>
</SelectionDock>
```

- ❌ 移除 `Rating` 元件、`dockRating` 狀態、重置 `$effect`
- ✅ 新增「退回」按鈕（空殼）、所有按鈕加 `disabled={ui.loading}`

---

### 3.10 `editorList.svelte.ts` — loading 邏輯下放

```ts
import { navigating } from "$app/state";

export function createEditorList() {
  const ctx = getEditorContext();

  const LOADING_DELAY = 200;
  let loading = $state(false);
  let showLoading = $state(false);

  $effect(() => {
    if (navigating.to) {
      loading = true;
      const timer = setTimeout(() => { showLoading = true; }, LOADING_DELAY);
      return () => {
        clearTimeout(timer);
        loading = false;
        showLoading = false;
      };
    }
  });

  return {
    get showLoading() { return showLoading; },
    // ...其餘不變
  };
}
```

- `EditorList.svelte` 中 `ctx.showLoading` 改為 `ui.showLoading`

---

### 3.11 不需變更的檔案

| 檔案 | 原因 |
|------|------|
| `EditorPagination.svelte` | 只讀 `ctx.page`、`ctx.pages`，仍在 ctx 中 |
| `FilterBar.svelte` | 共用元件，props 介面不變 |

---

## 四、資料流

### 4.1 篩選條件變更

```
使用者改 sort
    ↓
editorForm local $state 立即更新（UI 即時反映）
    ↓
handleFilterChange() → goto("/editor?sort=name", { replaceState, noScroll })
    ↓
SvelteKit 跑 +page.server.ts load（parseQueryParams → queryImages）
    ↓
data.result 更新
    ↓
+page.svelte $effect → ctx.items/total/page/pages 更新 → EditorList 重繪
```

### 4.2 搜尋文字輸入

```
使用者打 "cat"
    ↓
editorForm searchValue = "cat"（input 立即顯示）
    ↓
handleSearchInput() → 300ms debounce → goto("/editor?search=cat", { replaceState, noScroll })
    ↓
（同 4.1 後半段）
```

### 4.3 翻頁

```
使用者點第 3 頁
    ↓
handlePageClick(3) → 複製當前 URL params → 設 page=3 → goto()（不加 replaceState → 歷史記錄）
    ↓
（同 4.1 後半段）
```

### 4.4 批次刪除

```
使用者刪除 5 張圖
    ↓
handleDeleteClick() → loading = true → buttons disabled
    ↓
API 呼叫 → clearSelection() → invalidateAll() → load 重跑
    ↓
$effect → ctx 結果更新 → finally → loading = false → buttons re-enabled
```

### 4.5 瀏覽器上/下一步（popstate）

```
使用者按瀏覽器返回
    ↓
URL 被瀏覽器歷史改為舊的（例如 /editor?search=dog）
    ↓
SvelteKit 跑 load → data 更新 → $effect → ctx 結果更新
    ↓
afterNavigate(type='popstate') → parseQueryParams(page.url) → 同步 local state
    ↓
搜尋欄顯示 "dog"，FilterBar 顯示舊設定
```

---

## 五、Loading 處理

**現況**：三個 doSearch 各自管理 `loading` / `loadingTimer` / `showLoading`，透過 ctx 共享 timer 引用。

**改造後**：兩處各自管理，不再共享：

| 位置 | 用途 | 機制 |
|------|------|------|
| `editorList.svelte.ts` | 顯示「搜尋中…」 | `$effect` 追蹤 `navigating`，延遲 200ms 顯示 |
| `editorSelectionDock.svelte.ts` | 防止操作重複提交 + buttons disabled | unified `loading` 旗標，`try/finally` 管理 |

ctx 不再持有任何 timer 引用或 loading 狀態。

---

## 六、刪除的程式碼統計

| 被刪除的內容 | 來源 | 約行數 |
|-------------|------|--------|
| `doSearch()` + `validateSelection()` | `editorForm.svelte.ts` | ~40 |
| `doSearch()` + `validateSelection()` | `editorPagination.svelte.ts` | ~40 |
| `doSearch()` + `handleRatingChange()` | `editorSelectionDock.svelte.ts` | ~55 |
| Rating 元件 + dockRating + reset $effect | `EditorSelectionDock.svelte` | ~10 |
| 篩選欄位 × 6 | `context.svelte.ts` | ~12 |
| loading/showLoading + timer × 2 | `context.svelte.ts` | ~8 |
| 常數 LOADING_DELAY, SEARCH_DEBOUNCE | `context.svelte.ts` | ~4 |
| `import { api }` + `QueryResult` | 三個 `.svelte.ts` | ~6 |
| **合計** | | **~175** |

---

## 七、退回 staged 功能規劃

> 後續階段。本次只在 dock 中放空殼按鈕。

### 動機

原本 SelectionDock 的批次評等（逐筆 PATCH）有四個問題：
1. **只能改 rating**——tags 改不了
2. **N 張 = N 次 API**——存在 partial failure
3. **sort=rating 時排序錯亂**——需額外 `invalidateAll()` 處理
4. **本質是覆蓋**——而 staging 流程本就是設定 rating/tags 的地方

### 方案

| 步驟 | 內容 | 影響範圍 |
|------|------|----------|
| 1 | dock 移除 Rating → 改為「退回」按鈕 | 已包含在本次計畫（空殼） |
| 2 | 新增 API：committed → staged | 新端點 + DB 操作 |
| 3 | staged 列表排序改為由新到舊 | 修改 staged 查詢的排序 |

### 使用者流程

```
editor 選取圖片 → 點「退回」→ API 移回 staged → invalidateAll() → 列表更新
    ↓
staged 頁面 → 退回的圖在最上方 → 重新設定 rating/tags → commit
```

### 優勢

- 可同時修改 rating **和** tags
- 不需要批次 PATCH 邏輯，unstage 是單一 API 呼叫
- 沒有 partial failure、沒有排序錯亂
- 零新增 UI——復用已有的 staging 流程

---

## 八、設計決策 Q&A

### Q1：篩選 local state 為什麼放 editorForm 而不是 ctx？

篩選值只有 EditorForm 需要讀寫（FilterBar 透過 bind 連接）。其他元件只關心查詢結果，不需要知道 sort / search 是什麼。ctx 定位是「跨元件共享的響應式狀態」，篩選值不符合此定位。

### Q2：headless UI 為什麼自行讀 URL 而非接收 prop？

`page` from `$app/state` 本身就是 reactive 的，headless UI 可直接讀 `page.url.searchParams`。好處：
- `+page.server.ts` 不需額外 return `filters`
- `EditorForm.svelte` 不需接收任何 prop
- 與 `editorPagination.svelte.ts` 做法一致

### Q3：popstate 同步為什麼用 `afterNavigate` 而非 `$effect`？

`$effect` 監聽 `page.url.searchParams` 會在**每次**導航（包括使用者觸發的 goto）時觸發。問題場景：

1. 使用者打 "c" → debounce 未觸發
2. 使用者打 "ca" → debounce 觸發 → goto
3. 使用者打 "cat" → local = "cat"
4. goto for "ca" 完成 → $effect 讀到 "ca" → 覆蓋回 "ca" ← **錯誤**

`afterNavigate` + `type === "popstate"` 只在瀏覽器上下步時同步，避免此問題。

### Q4：EditorPagination 為什麼複製 URL 而非自己建 params？

翻頁只需複製當前 URL 再改 `page`，完全解耦於篩選邏輯。未來新增篩選欄位時不需要動它。

### Q5：為什麼移除 Rating 改用「退回 staged」？

批次評等有四個問題（只能改 rating、逐筆 PATCH、排序錯亂、本質是覆蓋）。退回 staged 用已有的 staging 流程解決所有問題——可同時改 rating 和 tags，單一 API 呼叫，零新增 UI。

### Q6：ctx 的 timer / loading 為什麼全部移除？

`doSearch()` 消除後不再有多個元件搶同一個 timer 的問題：
- `searchTimer` → editorForm 的 local 變數
- `loadingTimer` → 被 `$effect` + `navigating` 取代
- `loading`/`showLoading` → editorList 的 local `$state`
- 常數跟隨各自的 timer 下放

### Q7：為什麼不寫 `readURL()` 而是直接用 `parseQueryParams`？

兩者做的事幾乎一樣。差異（`search` 預設 `undefined` vs `""`、多回 `page`/`limit`）在呼叫端用 `?? ""` 和忽略不用的欄位即可解決。直接用 `parseQueryParams` 確保 parse/build 邏輯一致。

### Q8：`buildQueryString` 為什麼放 `$lib/utils.ts`？

1. 它是 `parseQueryParams()` 的反向操作，放在一起直覺
2. `URLSearchParams` 在 Node.js 與瀏覽器行為一致，無環境問題
3. 未來其他路由 URL 化時可直接復用

### Q9：`buildQueryString` 為什麼參數型別直接用 `QueryOptions`？

它是 `parseQueryParams` 的反向操作，型別應該對稱。`limit` 在 editor 路由不會設（server 端硬編碼 60），但函式本身處理它無壞處，其他路由可能需要。
