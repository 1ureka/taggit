# `/editor` URL 化改造 — 實作計畫（v2：Props 取代 Proxy）

> Report5 基礎上的修正：查詢結果改為 **props 向下傳遞**，不再透過 ctx 或 proxy 同步。
> ctx 瘦身至只剩 `selected`。SSR 自然運作，無需 proxy、無需 `$effect` 同步。

---

## 一、架構變更總覽

### Before（現行）

```
使用者改篩選 → ctx 更新 → doSearch() → API call → ctx 結果更新
                ctx 持有: searchText, selectedTags, rating, ratingOp, sort, order,
                          items, total, page, pages, loading, showLoading, selected

+page.svelte: proxy 包裝 data → 同步寫入 ctx（繞過 Svelte 5 reactivity 限制）
三處各 copy 一份 doSearch()（editorForm / editorPagination / editorSelectionDock）
```

### After（改造後）

```
使用者改篩選 → editorForm local state 更新 → goto(URL) → load(SSR) → data 更新
                                                                         ↓
                                                              +page.svelte 透過 props 傳遞

+page.svelte: 把 data.result 拆散成 props 傳給子元件（SSR 自然運作）
ctx 只持有: selected
loading → editorList 內部（追蹤 $navigating）
unified loading → editorSelectionDock 內部（所有操作互斥 + buttons disabled）
篩選狀態 → editorForm 的 local $state
Rating → 從 dock 移除，改為「退回 staged」按鈕（本階段先空殼）
doSearch() → 不再存在
```

### 為什麼不用 proxy / `$effect` 同步？

現行 `+page.svelte` 用 proxy 把 `data.recent` 包裝後寫入 ctx，是為了繞過 Svelte 5 的限制：

- 直接在 script 頂層寫 `ctx.items = data.result.items` → 編譯器警告「This reference only captures the initial value of `data`」
- 用 `$effect` 同步 → SSR 時 `$effect` 不執行，首屏 HTML 沒有資料

Props 是最乾淨的解法：`data` 本來就是 `$props()` 的一部分，直接拆散傳下去，Svelte 自動追蹤 prop 變更，SSR 時 props 照常運作。

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
- 放在 `parseQueryParams()` 旁邊，一對 parse/build 讀寫運算

---

### 3.2 `context.svelte.ts` — 只剩 `selected`

```ts
import { createContext } from "svelte";

export class EditorContext {
  selected = $state<Set<string>>(new Set());
}

export const [getEditorContext, setEditorContext] = createContext<EditorContext>();
```

移除清單：
- ❌ `PAGE_SIZE`、`LOADING_DELAY`、`SEARCH_DEBOUNCE`（常數跟隨各自使用處下放）
- ❌ `loadingTimer`、`searchTimer`（各自成為使用處的 local 變數）
- ❌ `searchText`、`selectedTags`、`rating`、`ratingOp`、`sort`、`order`（下放至 editorForm local $state）
- ❌ `items`、`total`、`page`、`pages`（改為 props 傳遞）
- ❌ `loading`、`showLoading`（下放至 editorList）

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
- 只回傳 `result`，不回傳 `filters`——前端直接從 `$page.url` 讀取

---

### 3.4 `+page.svelte` — Props 向下傳遞（核心變更）

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import { EditorContext, setEditorContext } from "./context.svelte.js";
  import EditorForm from "./EditorForm.svelte";
  import EditorList from "./EditorList.svelte";
  import EditorPagination from "./EditorPagination.svelte";
  import EditorSelectionDock from "./EditorSelectionDock.svelte";

  let { data }: { data: PageData } = $props();

  const ctx = setEditorContext(new EditorContext());
</script>

<!-- ...header 略... -->

<EditorForm />
<EditorList
  items={data.result.items}
  total={data.result.total}
  page={data.result.page}
  pages={data.result.pages}
/>
<EditorPagination page={data.result.page} pages={data.result.pages} />
<EditorSelectionDock />
```

**為什麼這樣寫可行：**

- `data` 是 `$props()` 的一部分，Svelte 會追蹤整個 `data` 的變更
- 當 `goto()` 觸發 `load` 重跑後，`data.result` 更新 → props 自動更新 → 子元件響應式重繪
- SSR 時 props 正常傳遞，首屏 HTML 就有完整資料
- 不需要 proxy，不需要 `$effect` 同步，不需要把結果塞進 ctx

**validateSelection 移至 `$effect`：**

```svelte
<script lang="ts">
  // ...同上...

  $effect(() => {
    // data.result.items 變更時，清理不在當前頁的 selected
    const visibleIds = new Set(data.result.items.map((i) => i.id));
    const next = new Set([...ctx.selected].filter((id) => visibleIds.has(id)));
    if (next.size !== ctx.selected.size) ctx.selected = next;
  });
</script>
```

`validateSelection` 只在此處執行一次，不再散落在三個 `doSearch` 中。 `$effect` 追蹤的是 `data.result.items`（來自 `$props()`），所以 `data` 的 reactivity 沒問題。

---

### 3.5 `editorForm.svelte.ts` — 篩選狀態下放為 local $state

```ts
import { goto, afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";

export function createEditorForm() {
  // 注意：不再 getEditorContext()

  // ─── 從 URL 讀取初始值 ──────────────────────────────
  const init = parseQueryParams(page.url);

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
- ❌ 不再 `getEditorContext()`——editorForm 完全不依賴 ctx
- ✅ 篩選狀態全部 local
- ✅ `afterNavigate` popstate 同步
- ✅ `buildQueryString` + `goto()` 取代 API call

---

### 3.6 `EditorForm.svelte` — 不變

```svelte
<script lang="ts">
  import { createEditorForm } from "./editorForm.svelte.js";
  const ui = createEditorForm();
</script>

<!-- bind:value={ui.searchValue} 等，與 report5 相同 -->
```

EditorForm 不接收任何 prop，不讀 ctx。

---

### 3.7 `editorList.svelte.ts` — 接收 options，loading 下放

```ts
import { navigating } from "$app/state";
import type { ImageWithId } from "$lib/types.js";
import { getEditorContext } from "./context.svelte.js";

interface EditorListOptions {
  readonly items: ImageWithId[];
}

export function createEditorList(options: EditorListOptions) {
  const ctx = getEditorContext(); // 只拿 selected

  // ─── Loading（追蹤 navigating）──────────────────────
  const LOADING_DELAY = 200;
  let showLoading = $state(false);

  $effect(() => {
    if (navigating.to) {
      const timer = setTimeout(() => { showLoading = true; }, LOADING_DELAY);
      return () => {
        clearTimeout(timer);
        showLoading = false;
      };
    }
  });

  // ─── 選取邏輯（與現行相同，只用 ctx.selected）─────────

  function isSelecting(): boolean {
    return ctx.selected.size > 0;
  }

  function selectAll() {
    ctx.selected = new Set(options.items.map((item) => item.id));
  }

  function invertSelection() {
    const next = new Set<string>();
    for (const item of options.items) {
      if (!ctx.selected.has(item.id)) next.add(item.id);
    }
    ctx.selected = next;
  }

  function clearSelection() {
    ctx.selected = new Set();
  }

  function toggleSelect(id: string) {
    const next = new Set(ctx.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    ctx.selected = next;
  }

  // ... handleCardClick, handleCheckboxChange, handleWindowKeydown 不變 ...

  return {
    get showLoading() { return showLoading; },
    handleCardClick,
    handleCheckboxChange,
    handleWindowKeydown,
  };
}
```

**重點**：`options.items` 透過 getter 取值（見 3.8），所以 props 更新時 `selectAll()` / `invertSelection()` 自動拿到新值。

---

### 3.8 `EditorList.svelte` — 接收 props，傳遞 getter 給 headless UI

```svelte
<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import SelectCheckbox from "$lib/components/SelectCheckbox.svelte";
  import { getEditorContext } from "./context.svelte.js";
  import { createEditorList } from "./editorList.svelte.js";

  type Props = { items: ImageWithId[]; total: number; page: number; pages: number };
  let { items, total, page, pages }: Props = $props();

  const ctx = getEditorContext(); // 讀 selected（template 需要）
  const ui = createEditorList({
    get items() { return items; },
  });
</script>

{#if total > 0}
  <div class="editor-list-info">
    <span>{total} 張圖片</span>
    {#if pages > 1}
      <span class="editor-list-pager">第 {page} / {pages} 頁</span>
    {/if}
  </div>
{/if}

{#if ui.showLoading}
  <div class="editor-list-status">搜尋中...</div>
{:else if items.length === 0}
  <div class="editor-list-status">找不到符合的圖片</div>
{:else}
  <div class="editor-list-results">
    {#each items as img (img.id)}
      {@const selected = ctx.selected.has(img.id)}
      <!-- ...card 內容不變... -->
    {/each}
  </div>
{/if}
```

**差異**：
- ✅ `items`、`total`、`page`、`pages` 全改為 props
- ✅ `ui.showLoading` 取代 `ctx.showLoading`
- ✅ `ctx` 只用於讀 `selected`（template 內的 `ctx.selected.has()`）
- ✅ `createEditorList({ get items() { return items; } })` — getter 確保 headless UI 讀到最新 props

---

### 3.9 `editorPagination.svelte.ts` — 大幅簡化

```ts
import { goto } from "$app/navigation";
import { page } from "$app/state";

interface EditorPaginationOptions {
  readonly pages: number;
}

export function createEditorPagination(options: EditorPaginationOptions) {
  // 不再 getEditorContext()

  function handlePageClick(p: number) {
    if (p < 1 || p > options.pages) return;
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
- ❌ 不再 `getEditorContext()`——pagination 完全不依賴 ctx
- ✅ 複製當前 URL params → 只改 `page` → `goto()`

---

### 3.10 `EditorPagination.svelte` — 接收 props

```svelte
<script lang="ts">
  import { createEditorPagination } from "./editorPagination.svelte.js";

  type Props = { page: number; pages: number };
  let { page, pages }: Props = $props();

  const ui = createEditorPagination({
    get pages() { return pages; },
  });
</script>

{#if pages > 1}
  <div class="editor-pagination">
    <button class="btn btn-sm" disabled={page <= 1} onclick={() => ui.handlePageClick(page - 1)}>
      上一頁
    </button>
    {#each Array.from({ length: Math.min(pages, 7) }, (_, i) => {
      if (pages <= 7) return i + 1;
      if (page <= 4) return i + 1;
      if (page >= pages - 3) return pages - 6 + i;
      return page - 3 + i;
    }) as p}
      <button class="btn btn-sm" class:btn-primary={p === page} onclick={() => ui.handlePageClick(p)}>
        {p}
      </button>
    {/each}
    <button class="btn btn-sm" disabled={page >= pages} onclick={() => ui.handlePageClick(page + 1)}>
      下一頁
    </button>
  </div>
{/if}
```

**差異**：
- ❌ 不再 `getEditorContext()`
- ✅ `page`、`pages` 改為 props
- template 中所有 `ctx.page` → `page`，`ctx.pages` → `pages`

---

### 3.11 `editorSelectionDock.svelte.ts` — 移除 Rating、unified loading

```ts
import { invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast, requestConfirm } from "$lib/client/dom.js";
import { getEditorContext } from "./context.svelte.js";

export function createEditorSelectionDock() {
  const ctx = getEditorContext(); // 只用 selected

  const count = $derived(ctx.selected.size);

  // ─── Unified Loading ─────────────────────────────────
  let loading = $state(false);

  function clearSelection() {
    ctx.selected = new Set();
  }

  async function handleDeleteClick() {
    if (loading) return;
    const ids = [...ctx.selected];
    if (ids.length === 0) return;

    const ok = await requestConfirm(`確定要刪除已選取的 ${ids.length} 張圖片嗎？此操作無法復原。`);
    if (!ok) return;

    loading = true;
    try {
      let successCount = 0;
      let failCount = 0;
      for (const id of ids) {
        const res = await api.del(`/api/images/${encodeURIComponent(id)}`);
        if (res.ok) successCount++;
        else failCount++;
      }
      clearSelection();
      await invalidateAll(); // 重跑 load → data 更新 → props 更新
      if (failCount > 0) addToast(`已刪除 ${successCount} 張，${failCount} 張失敗`, "error");
      else addToast(`已刪除 ${successCount} 張圖片`, "success");
    } finally {
      loading = false;
    }
  }

  async function handleUnstageClick() {
    // 本階段先空殼，見「七、退回 staged 功能規劃」
  }

  function handleCloseClick() {
    clearSelection();
  }

  return {
    get count() { return count; },
    get loading() { return loading; },
    handleCloseClick,
    handleDeleteClick,
    handleUnstageClick,
  };
}
```

**差異**：
- ❌ 刪除 `doSearch()`（~30 行）、`handleRatingChange()`（~25 行）
- ✅ `invalidateAll()` 取代 `doSearch()`——load 重跑 → data 更新 → props 自動傳遞
- ✅ unified loading：`if (loading) return` + `try/finally`

---

### 3.12 `EditorSelectionDock.svelte` — 移除 Rating，新增退回按鈕

```svelte
<script lang="ts">
  import { IconTrash, IconArrowBackUp } from "@tabler/icons-svelte";
  import SelectionDock from "$lib/components/SelectionDock.svelte";
  import { createEditorSelectionDock } from "./editorSelectionDock.svelte.js";

  const ui = createEditorSelectionDock();
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

### 3.13 不需變更的檔案

| 檔案 | 原因 |
|------|------|
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
+page.svelte 的 props 自動傳遞 → EditorList / EditorPagination 重繪
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
data.result 更新 → props 自動傳遞 → finally → loading = false → buttons re-enabled
```

### 4.5 瀏覽器上/下一步（popstate）

```
使用者按瀏覽器返回
    ↓
URL 被瀏覽器歷史改為舊的（例如 /editor?search=dog）
    ↓
SvelteKit 跑 load → data 更新 → props 傳遞 → EditorList / EditorPagination 重繪
    ↓
afterNavigate(type='popstate') → parseQueryParams(page.url) → 同步 editorForm local state
    ↓
搜尋欄顯示 "dog"，FilterBar 顯示舊設定
```

---

## 五、各元件的資料來源對照

| 元件 | 以前從哪拿 | 改造後從哪拿 |
|------|-----------|-------------|
| EditorForm — 篩選值 | `ctx.searchText` 等 | local `$state` + `$page.url` |
| EditorList — items | `ctx.items` | **props** (from `+page.svelte`) |
| EditorList — total/page/pages | `ctx.total` 等 | **props** |
| EditorList — showLoading | `ctx.showLoading` | local `$state`（追蹤 `$navigating`） |
| EditorList — selected | `ctx.selected` | **ctx**（唯一仍從 ctx 讀取的） |
| EditorPagination — page/pages | `ctx.page`, `ctx.pages` | **props** |
| EditorSelectionDock — count | `ctx.selected.size` | **ctx** |
| EditorSelectionDock — loading | 無（改造新增） | local `$state` |

---

## 六、Loading 處理

| 位置 | 用途 | 機制 |
|------|------|------|
| `editorList.svelte.ts` | 顯示「搜尋中…」 | `$effect` 追蹤 `navigating`，延遲 200ms 顯示 |
| `editorSelectionDock.svelte.ts` | 防止操作重複提交 + buttons disabled | unified `loading` 旗標，`try/finally` 管理 |

ctx 不再持有任何 timer 引用或 loading 狀態。

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

---

## 八、設計決策 Q&A

### Q1：為什麼從 ctx 改為 props 傳遞查詢結果？

Svelte 5 的 `$props()` 解構出的 `data` 如果直接在頂層同步寫入 ctx，會觸發編譯器警告「This reference only captures the initial value of `data`」。現行的 proxy 包裝雖然繞過了警告，但本質是個 hack。

Props 是 Svelte 原生的響應式傳遞機制：
- `data.result.items` 變更 → 子元件的 `items` prop 自動更新
- SSR 時 props 正常運作，首屏 HTML 有完整資料
- 不需要 proxy、不需要 `$effect` 同步、不需要 ctx 中轉

### Q2：ctx 為什麼只剩 `selected`？

逐項檢查：
- **篩選值**：只有 EditorForm 讀寫 → local state
- **查詢結果**：只從上往下流 → props
- **loading**：只有 EditorList 用 → local state
- **selected**：EditorList（讀寫 + template）和 EditorSelectionDock（讀）都需要 → **唯一需要跨元件共享的狀態**

### Q3：headless UI 怎麼接收 props？

透過 getter-based options 物件。Svelte 元件把 `$props()` 解構出的值透過 getter 傳給 factory function：

```svelte
const ui = createEditorList({
  get items() { return items; },
});
```

headless UI 內部呼叫 `options.items` 時，走 getter 拿到**當下最新的** prop 值。跟共用元件（如 FilterBar 透過 props + bind）的思路一樣——資料從上往下流。

### Q4：篩選 local state 為什麼放 editorForm 而不是 ctx？

篩選值只有 EditorForm 需要讀寫（FilterBar 透過 bind 連接）。其他元件只關心查詢結果，不需要知道 sort / search 是什麼。

### Q5：popstate 同步為什麼用 `afterNavigate` 而非 `$effect`？

`$effect` 監聯 `$page.url.searchParams` 會在**每次**導航時觸發。問題場景：

1. 使用者打 "c" → debounce 未觸發
2. 使用者打 "ca" → debounce 觸發 → goto
3. 使用者打 "cat" → local = "cat"
4. goto for "ca" 完成 → `$effect` 讀到 "ca" → 覆蓋回 "ca" ← **錯誤**

`afterNavigate` + `type === "popstate"` 只在瀏覽器上下步時同步，避免此問題。

### Q6：`buildQueryString` 為什麼放 `$lib/utils.ts`？

它是 `parseQueryParams()` 的反向操作，放在一起直覺。`URLSearchParams` 在 Node.js 與瀏覽器行為一致，無環境問題。未來其他路由 URL 化時可直接復用。

### Q7：為什麼移除 Rating 改用「退回 staged」？

批次評等有四個問題（只能改 rating、逐筆 PATCH、排序錯亂、本質是覆蓋）。退回 staged 用已有的 staging 流程解決所有問題——可同時改 rating 和 tags，單一 API 呼叫，零新增 UI。

### Q8：EditorPagination 為什麼複製 URL 而非用 `buildQueryString`？

翻頁只需複製當前 URL 再改 `page`，完全解耦於篩選邏輯。未來新增篩選欄位時不需要動它。

### Q9：`validateSelection` 為什麼放在 `+page.svelte` 的 `$effect` 裡？

它需要同時存取 `data.result.items`（props 層級）和 `ctx.selected`（ctx 層級）。放在 `+page.svelte` 是唯一兩者都可得的位置。且所有導致 items 變更的情境（goto、popstate、invalidateAll）都會觸發此 `$effect`。

---

## 九、刪除的程式碼統計

| 被刪除的內容 | 來源 | 約行數 |
|-------------|------|--------|
| `doSearch()` + `validateSelection()` | `editorForm.svelte.ts` | ~40 |
| `doSearch()` + `validateSelection()` | `editorPagination.svelte.ts` | ~40 |
| `doSearch()` + `handleRatingChange()` | `editorSelectionDock.svelte.ts` | ~55 |
| Rating 元件 + dockRating + reset $effect | `EditorSelectionDock.svelte` | ~10 |
| 篩選欄位 × 6 + 結果欄位 × 4 | `context.svelte.ts` | ~20 |
| loading/showLoading + timer × 2 + 常數 | `context.svelte.ts` | ~12 |
| proxy 包裝 | `+page.svelte` | ~12 |
| `import { api }` + `QueryResult` | 三個 `.svelte.ts` | ~6 |
| **合計** | | **~195** |
