# `/editor` 路由改造詳細報告

> 本報告為 `/editor` 路由遷移至 URL query params 驅動的完整設計文件。
> 目標：將 `/editor` 打造為**參考實作**，其模式可直接複製至 `/scroll`、`/trash`、`/compare` 等路由。
> 除了 URL 化之外，也一併審視 HTML 結構的 web 標準合規性，使整體品質向瀏覽器原生語義靠攏。

---

## 一、URL Query Params 改造

### 1.1 目標 URL 格式

```
/editor?search=cat&tags=animal,cute&rating=3&ratingOp=gte&sort=rating&order=desc&page=2
```

預設值時省略（保持 URL 簡潔）：

| 參數 | 預設值 | 省略規則 |
|------|--------|---------|
| `search` | `""` | 空字串時省略 |
| `tags` | `[]` | 無標籤時省略 |
| `rating` | `undefined` | 未設定時省略 |
| `ratingOp` | `"gte"` | 為預設值時省略 |
| `sort` | `"committedAt"` | 為預設值時省略 |
| `order` | `"desc"` | 為預設值時省略 |
| `page` | `1` | 為第 1 頁時省略 |

所以「剛進頁面、無任何篩選」的 URL 就是乾淨的 `/editor`。

### 1.2 `+page.server.ts` — SSR 直接依據 URL 查詢

**現況**：硬編碼查 60 筆最新圖片，忽略所有篩選條件。

```ts
// 現況
export const load: PageServerLoad = () => {
  const recent = queryImages(loaded.db, { limit: 60, sort: "committedAt", order: "desc" });
  return { recent };
};
```

**改造後**：讀取 `url.searchParams`，復用已有的 `parseQueryParams()`。

```ts
// 改造後
import { parseQueryParams } from "$lib/utils.js";

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const opts = parseQueryParams(url);
  opts.limit = 60; // 強制 page size
  const result = queryImages(loaded.db, opts);
  return { result };
};
```

**收益**：
- SSR 與 CSR 走同一條查詢路徑，首屏即是正確結果
- 書籤化的 URL 重新開啟時直接看到對應查詢結果，無需等待 client API 呼叫
- `/browse/player` 已經在用 `parseQueryParams()`，模式完全一致

### 1.3 `+page.svelte` — 從 SSR data 初始化 Context

**現況**：只將 `items` 和 `total` 注入 Context，篩選條件全為硬編碼預設值。

**改造後**：SSR 額外回傳已解析的篩選條件，一併注入 Context。

```ts
// +page.server.ts 同時回傳查詢結果與解析後的篩選條件
return {
  result,
  filters: {
    search: opts.search ?? "",
    tags: opts.tags ?? [],
    rating: opts.rating,
    ratingOp: opts.ratingOp ?? "gte",
    sort: opts.sort ?? "committedAt",
    order: opts.order ?? "desc",
  },
};
```

```svelte
<!-- +page.svelte -->
<script>
  const ctx = setEditorContext(new EditorContext());
  // 從 SSR data 同步篩選條件
  ctx.items = proxy.items;
  ctx.total = proxy.total;
  ctx.page = data.result.page;
  ctx.pages = data.result.pages;
  ctx.searchText = data.filters.search;
  ctx.selectedTags = data.filters.tags;
  ctx.rating = data.filters.rating;
  ctx.ratingOp = data.filters.ratingOp;
  ctx.sort = data.filters.sort;
  ctx.order = data.filters.order;
</script>
```

### 1.4 `editorForm.svelte.ts` — 篩選變更 → 更新 URL

**現況**：篩選變更 → 建構 `URLSearchParams` → client API 呼叫 → 手動寫入 Context。

**改造後**：篩選變更 → 建構 URL query string → `goto()` → SvelteKit 重新執行 `load` → data 自動更新。

```ts
import { goto } from "$app/navigation";

function buildQueryString(): string {
  const params = new URLSearchParams();
  if (ctx.searchText.trim()) params.set("search", ctx.searchText.trim());
  if (ctx.selectedTags.length > 0) params.set("tags", ctx.selectedTags.join(","));
  if (ctx.rating !== undefined) {
    params.set("rating", String(ctx.rating));
    if (ctx.ratingOp !== "gte") params.set("ratingOp", ctx.ratingOp);
  }
  if (ctx.sort !== "committedAt") params.set("sort", ctx.sort);
  if (ctx.order !== "desc") params.set("order", ctx.order);
  // page 在此省略（篩選變更時重置為 1）
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function handleSearchInput() {
  if (ctx.searchTimer) clearTimeout(ctx.searchTimer);
  ctx.searchTimer = setTimeout(() => {
    goto(`/editor${buildQueryString()}`, { replaceState: true, noScroll: true });
  }, ctx.SEARCH_DEBOUNCE);
}

function handleFilterChange() {
  goto(`/editor${buildQueryString()}`, { replaceState: true, noScroll: true });
}
```

**關鍵設計決策**：
- 篩選/搜尋變更用 `replaceState: true`：避免每次輸入字元都產生一條瀏覽器歷史
- `noScroll: true`：防止 SvelteKit 導航時自動捲回頂部

### 1.5 `editorPagination.svelte.ts` — 翻頁 → pushState

翻頁與篩選不同，每次翻頁**應該**產生歷史記錄（按返回鍵 = 回到上一頁）：

```ts
function handlePageClick(p: number) {
  if (p < 1 || p > ctx.pages) return;
  const params = new URLSearchParams(window.location.search);
  if (p > 1) {
    params.set("page", String(p));
  } else {
    params.delete("page");
  }
  const qs = params.toString();
  goto(`/editor${qs ? `?${qs}` : ""}`, { noScroll: true });
  // pushState（不加 replaceState）→ 產生歷史記錄
}
```

### 1.6 `editorSelectionDock.svelte.ts` — 批次操作後的刷新

刪除/評等等批次操作完成後，需要重新查詢。改造後不再自己呼叫 API，而是透過 `invalidateAll()` 觸發 SvelteKit 重新執行 `load`：

```ts
import { invalidateAll } from "$app/navigation";

async function handleDeleteClick() {
  // ...批次刪除 API 呼叫...
  ctx.selected = new Set();
  await invalidateAll(); // 觸發 load 重新查詢，資料自動更新
}
```

### 1.7 消除重複的 `doSearch()`

**現況**：`editorForm.svelte.ts`、`editorPagination.svelte.ts`、`editorSelectionDock.svelte.ts` 各有一份幾乎相同的 `doSearch()` 函式（約 25 行 × 3）。

**改造後**：三處全部消除。
- 篩選/搜尋變更 → `goto()` → `load` 自動執行
- 翻頁 → `goto()` 帶 `page` 參數 → `load` 自動執行
- 批次操作後 → `invalidateAll()` → `load` 自動執行

`doSearch()` 的職責完全由 SvelteKit 的 `load` 機制接管，程式碼總量大幅縮減。

### 1.8 loading 狀態處理

`goto()` 觸發的 `load` 是異步的，SvelteKit 提供 `navigating` store 來偵測導航狀態：

```ts
import { navigating } from "$app/stores";

// 在 context 或無頭 UI 中追蹤 loading
$effect(() => {
  ctx.loading = !!$navigating;
});
```

或保留原本的 `loadingTimer` 延遲策略（只在導航超過 200ms 時才顯示 loading 畫面），避免快速查詢造成閃爍。

---

## 二、HTML 結構 Web 標準改造

### 2.1 搜尋表單：`<div>` → `<form>`

**現況**（`EditorForm.svelte`）：

```html
<div class="editor-form">
  <div class="search-input-wrap">
    <span class="search-adornment"><IconSearch /></span>
    <input class="text-input search-input"
           bind:value={ctx.searchText}
           placeholder="搜尋檔名..."
           oninput={ui.handleSearchInput}
           autocomplete="off" />
  </div>
  <div class="editor-filters">
    <FilterBar ... />
  </div>
</div>
```

**問題**：
1. 外層是 `<div>` 而非 `<form>`——失去了原生表單語義
2. 搜尋欄沒有 `<label>`——螢幕閱讀器無法識別用途
3. 輸入框內的 icon adornment 用 `<span>` 而非 `aria-hidden` 裝飾——對輔助技術無意義但可能被讀出
4. 整個搜尋＋篩選區域沒有 `role="search"` 標註

**建議改造**：

```html
<form class="editor-form" role="search" onsubmit|preventDefault>
  <div class="search-input-wrap">
    <span class="search-adornment" aria-hidden="true"><IconSearch /></span>
    <input class="text-input search-input"
           bind:value={ctx.searchText}
           placeholder="搜尋檔名..."
           oninput={ui.handleSearchInput}
           autocomplete="off"
           aria-label="搜尋檔名" />
  </div>
  <div class="editor-filters">
    <FilterBar ... />
  </div>
</form>
```

**變更重點**：
- `<div>` → `<form role="search">`：瀏覽器和輔助技術的 landmark 識別
- `onsubmit|preventDefault`：防止表單提交產生頁面刷新（此專案靠 `oninput` + debounce 觸發查詢）
- `aria-label="搜尋檔名"`：為搜尋輸入框提供無障礙標籤
- `aria-hidden="true"`：明確標記裝飾性 icon

**影響範圍**：`EditorForm.svelte`、`TrashForm.svelte`（結構相同）

### 2.2 FilterBar：加入 `<fieldset>` / label 語義

**現況**（`FilterBar.svelte`）：

```html
<div class="filter-bar">
  <Autocomplete bind:tags={selectedTags} variant="inline" placeholder="篩選標籤..." {onchange} />
  <div class="filter-controls">
    <span class="filter-label">評分</span>
    <Select bind:value={ratingOp} options={ratingOpOptions} ... />
    <Select bind:value={rating} options={ratingOptions} ... />
    <span class="filter-label">排序</span>
    <Select bind:value={sort} options={sortOptions} ... />
    <Select bind:value={order} options={orderOptions} ... />
  </div>
</div>
```

**問題**：
1. `<span class="filter-label">` 視覺上是標籤，但和 `<Select>` 沒有程式化關聯——輔助技術看不出「評分」和後面兩個下拉選單的關係
2. 外層 `<div class="filter-bar">` 沒有 `role="group"` 或 `<fieldset>` 語義——多個篩選控制項沒有被分組

**建議改造**：

```html
<div class="filter-bar" role="group" aria-label="篩選條件">
  <Autocomplete bind:tags={selectedTags} variant="inline" placeholder="篩選標籤..." {onchange} />
  <div class="filter-controls">
    <span class="filter-label" id="fl-rating">評分</span>
    <Select bind:value={ratingOp} options={ratingOpOptions} aria-labelledby="fl-rating" ... />
    <Select bind:value={rating} options={ratingOptions} aria-labelledby="fl-rating" ... />
    <span class="filter-label" id="fl-sort">排序</span>
    <Select bind:value={sort} options={sortOptions} aria-labelledby="fl-sort" ... />
    <Select bind:value={order} options={orderOptions} aria-labelledby="fl-sort" ... />
  </div>
</div>
```

**但此處有實務取捨**：
- `<Select>` 是自訂元件，其內部的 `<button>` trigger 需接受 `aria-labelledby` prop 才能傳遞到真正的 DOM 按鈕上。這意味著 `Select.svelte` 需要新增 `ariaLabel` 或 `ariaLabelledby` prop。
- 若不想動共用元件，可退而求其次，在 `<span class="filter-label">` 旁邊加一個視覺隱藏的 `<label>`。但這更囉嗦。

**建議**：為 `Select` 元件新增 `aria-label` prop（改動極小，收益大）。

### 2.3 Select 元件：補充 ARIA 屬性

**現況**（`Select.svelte`）：

```html
<button class="select-trigger" ...>
  <span class="select-label">{ui.selectedLabel}</span>
  <span class="select-chevron"><IconChevronDown /></span>
</button>
<div class="popover" role="listbox" ...>
  <button role="option" aria-selected={...} ...>{opt.label}</button>
</div>
```

**已做得好的部分**：
- ✅ `role="listbox"` + `role="option"` + `aria-selected`
- ✅ 使用 `<button>` 元素（可鍵盤操作、可聚焦）
- ✅ 鍵盤快捷鍵完整（Tab / Arrow / Enter / Space / Escape）

**建議補充**：

```html
<button class="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={ui.open}
        aria-label={ariaLabel}
        ...>
```

| 新增屬性 | 說明 |
|---------|------|
| `aria-haspopup="listbox"` | 告知輔助技術此按鈕會展開選單 |
| `aria-expanded` | 告知選單目前是開啟還是關閉 |
| `aria-label` | 外部傳入的標籤（如「排序方式」），使按鈕不只顯示當前選中值 |

**Select.svelte 改動**：新增可選 `ariaLabel` prop，透傳至 trigger `<button>`。

### 2.4 Autocomplete 元件：補充 ARIA combobox 角色

**現況**（`Autocomplete.svelte`）：

```html
<div class="autocomplete">
  <div class="chip-list">...</div>
  <input ... autocomplete="off" />
  <div class="popover">
    <div role="option" aria-selected={...} ...>...</div>
  </div>
</div>
```

**問題**：
1. `<input>` 沒有 `role="combobox"` — 這是一個自動完成輸入框的標準 ARIA 模式
2. 下拉列表沒有 `role="listbox"` — option 有了但容器沒有
3. `<input>` 和下拉列表沒有 `aria-controls` / `aria-activedescendant` 關聯
4. `<input>` 缺少 `aria-label`

**建議補充**（最小化改動）：

```html
<input
  role="combobox"
  aria-autocomplete="list"
  aria-expanded={ui.showDropdown && ui.dropdownTags.length > 0}
  aria-label={ariaLabel ?? placeholder}
  ...
/>
<div class="popover" role="listbox" ...>
```

完整的 `aria-activedescendant` + `id` 方案較複雜，可作為第二階段改進。最低成本的改動是加上 `role="combobox"` + `aria-expanded` + `role="listbox"`。

### 2.5 圖片清單卡片：`<div onclick>` → 語義化互動元素

**現況**（`EditorList.svelte`）：

```html
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="editor-list-card select-checkbox-host"
     onclick={() => ui.handleCardClick(img.id)}>
  <img ... />
  <div class="editor-list-card-info">...</div>
  <SelectCheckbox ... />
</div>
```

**問題**：
1. `<div onclick>` 不是互動元素——不可聚焦、沒有鍵盤支援、輔助技術不視為按鈕
2. 被迫用 `<!-- svelte-ignore -->` 壓制 a11y 警告——這些警告正是在提醒不合標準
3. 使用者無法用 Tab 鍵在卡片之間移動

**方案 A：改為 `<button>`**

```html
<button type="button"
        class="editor-list-card select-checkbox-host"
        onclick={() => ui.handleCardClick(img.id)}>
  ...
</button>
```

優點：最語義化、自帶鍵盤支援和聚焦。
缺點：`<button>` 內部放 `<div>`、`<img>` 等區塊元素在 HTML5 規範中是合法的，但需要 CSS 重寫（`<button>` 的預設 `display`、`text-align`、`font` 需要覆蓋）。

**方案 B：保留 `<div>` 但加上 `role` 和 `tabindex`**

```html
<div class="editor-list-card select-checkbox-host"
     role="button"
     tabindex="0"
     onclick={() => ui.handleCardClick(img.id)}
     onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.handleCardClick(img.id); } }}>
  ...
</div>
```

優點：不用改 CSS。
缺點：需要手動處理 Enter/Space 鍵盤事件。

**建議**：採用**方案 A**（改為 `<button>`）。理由：
- 原生語義最正確
- 不需要 `<!-- svelte-ignore -->` 註解
- 不需要手動加鍵盤事件
- CSS 重寫量不大（加上 `all: unset` 或逐項覆蓋即可）
- `<button>` 內部放 `<img>` + `<div>` 在 HTML5 中完全合法

**影響範圍**：`EditorList.svelte`、`TrashList.svelte`（同樣使用 `<div onclick>` 卡片模式）

### 2.6 分頁：`<div>` → `<nav>` + ARIA 標註

**現況**（`EditorPagination.svelte`）：

```html
<div class="editor-pagination">
  <button class="btn btn-sm" disabled={ctx.page <= 1} ...>上一頁</button>
  {#each ... as p}
    <button class="btn btn-sm" class:btn-primary={p === ctx.page} ...>{p}</button>
  {/each}
  <button class="btn btn-sm" disabled={ctx.page >= ctx.pages} ...>下一頁</button>
</div>
```

**已做得好的部分**：
- ✅ 正確使用 `<button>` 元素
- ✅ `disabled` 屬性正確處理邊界

**建議補充**：

```html
<nav class="editor-pagination" aria-label="分頁導航">
  <button ... aria-label="上一頁">上一頁</button>
  {#each ... as p}
    <button ... aria-label="第 {p} 頁" aria-current={p === ctx.page ? "page" : undefined}>
      {p}
    </button>
  {/each}
  <button ... aria-label="下一頁">下一頁</button>
</nav>
```

| 變更 | 說明 |
|------|------|
| `<div>` → `<nav>` | 語義化導航 landmark |
| `aria-label="分頁導航"` | 區分頁面上可能有多個 `<nav>` |
| `aria-current="page"` | 標記當前頁碼按鈕 |
| 按鈕 `aria-label` | 「第 3 頁」比純數字「3」對螢幕閱讀器更友好 |

**影響範圍**：`EditorPagination.svelte`、`TrashPagination.svelte`

### 2.7 SelectCheckbox：`<div>` → `<input type="checkbox">`（或加全套 ARIA）

**現況**（`SelectCheckbox.svelte`）：

```html
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="select-checkbox"
     class:select-checkbox-checked={checked}
     onclick={handleClick}
     role="checkbox"
     aria-checked={checked}
     tabindex="-1">
  {#if checked}<IconCheck ... />{/if}
</div>
```

**分析**：
- 已有 `role="checkbox"` + `aria-checked`，ARIA 語義上是合格的
- `tabindex="-1"` 代表不進入 Tab 順序——這是刻意設計（由父卡片處理整體互動）
- `<!-- svelte-ignore -->` 是因為 Svelte 偵測到 `<div>` 有 `onclick` 但沒有 `onkeydown`

**建議**：由於 checkbox 故意不可獨立聚焦（`tabindex="-1"`），且鍵盤交互由父卡片的 `Ctrl+A`/ 點擊等處理，目前設計算是合理的。若卡片改為 `<button>`（§2.5），且 checkbox 的 `e.stopPropagation()` 機制不變，則不需要大改。

唯一建議是加上 `onkeydown` 空處理以消除 Svelte 警告（而非用 ignore 壓制）：

```html
<div ... onkeydown={() => {}}>
```

### 2.8 SelectionDock：無障礙改進

**現況**（`SelectionDock.svelte`）：

```html
<div class="selection-dock" transition:fly={...}>
  <div class="dock-inner">
    <button class="btn btn-ghost btn-sm dock-close" onclick={onclose} title="取消選取">
      <IconX size={16} />
    </button>
    <span class="dock-count">已選取 {count} 張</span>
    <div class="dock-separator"></div>
    {@render children()}
  </div>
</div>
```

**建議補充**：

```html
<div class="selection-dock" role="toolbar" aria-label="批次操作" transition:fly={...}>
  <div class="dock-inner">
    <button ... aria-label="取消選取">
      <IconX size={16} />
    </button>
    <span class="dock-count" aria-live="polite">已選取 {count} 張</span>
    ...
  </div>
</div>
```

| 變更 | 說明 |
|------|------|
| `role="toolbar"` | 語義化工具列 |
| `aria-label="批次操作"` | 標明工具列用途 |
| `aria-live="polite"` | 選取數量變化時，螢幕閱讀器會自動朗讀更新 |
| `aria-label` 取代 `title` | `title` 的輔助技術支援不一致，`aria-label` 更可靠 |

---

## 三、共用元件改動彙整

以下表格列出所有涉及的共用元件改動。這些改動對所有使用該元件的路由都有效，不僅限於 `/editor`。

| 元件 | 改動項目 | 改動大小 | 說明 |
|------|---------|---------|------|
| **Select.svelte** | 新增 `ariaLabel` prop | 極小 | 透傳至 trigger `<button>` 的 `aria-label`；同時加上 `aria-haspopup="listbox"` + `aria-expanded` |
| **Autocomplete.svelte** | 加 `role="combobox"` + `aria-expanded` + `aria-label` | 小 | 下拉列表加 `role="listbox"` |
| **FilterBar.svelte** | 外層加 `role="group"` + `aria-label`；label 加 `id` | 小 | 讓 Select 的 `aria-labelledby` 可以指向對應 label `id` |
| **SelectionDock.svelte** | `role="toolbar"` + `aria-label` + `aria-live` | 極小 | 純增量，不改現有結構 |
| **SelectCheckbox.svelte** | 加空 `onkeydown` handler | 極小 | 消除 svelte-ignore 註解 |
| **Rating.svelte** | — | 無 | 已有完整 ARIA（`role="spinbutton"` + `aria-valuenow/min/max/text`），業界最佳實踐 |

---

## 四、路由層改動彙整

| 檔案 | 改動項目 | 改動大小 |
|------|---------|---------|
| **+page.server.ts** | 讀取 `url.searchParams` + `parseQueryParams()` | 小 |
| **+page.svelte** | SSR data 初始化篩選條件至 Context | 小 |
| **EditorForm.svelte** | `<div>` → `<form role="search">`；input 加 `aria-label`；adornment 加 `aria-hidden` | 小 |
| **editorForm.svelte.ts** | `doSearch()` → `goto()` + `buildQueryString()`；移除 API 呼叫 | 中 |
| **EditorList.svelte** | 卡片 `<div>` → `<button>`；移除 svelte-ignore 註解 | 中 |
| **editorList.svelte.ts** | 無需改動（鍵盤快捷鍵、選取邏輯不受影響） | 無 |
| **EditorPagination.svelte** | `<div>` → `<nav>`；加 `aria-label`、`aria-current` | 小 |
| **editorPagination.svelte.ts** | `doSearch()` → `goto()` 帶 page 參數；移除 API 呼叫 | 中（大幅簡化） |
| **EditorSelectionDock.svelte** | 無需改動 | 無 |
| **editorSelectionDock.svelte.ts** | `doSearch()` → `invalidateAll()`；移除 API 呼叫 | 中（大幅簡化） |
| **context.svelte.ts** | 無需改動（結構不變，初始值來源改為 SSR data） | 無 |

---

## 五、實作順序建議

### Phase 1：URL params 基礎設施

1. **`+page.server.ts`**：改為讀取 URL params 查詢
2. **`+page.svelte`**：從 SSR data 初始化 Context 的篩選條件
3. **`editorForm.svelte.ts`**：篩選/搜尋 → `goto()` + `replaceState`
4. **`editorPagination.svelte.ts`**：翻頁 → `goto()` + `pushState`
5. **`editorSelectionDock.svelte.ts`**：批次操作後 → `invalidateAll()`

此階段完成後，URL params 功能即完整可用。

### Phase 2：HTML 語義化（共用元件）

6. **`Select.svelte`**：新增 `ariaLabel` prop + `aria-haspopup` + `aria-expanded`
7. **`Autocomplete.svelte`**：加 `role="combobox"` + `aria-expanded`
8. **`FilterBar.svelte`**：加 `role="group"` + label `id`
9. **`SelectionDock.svelte`**：加 `role="toolbar"` + `aria-live`
10. **`SelectCheckbox.svelte`**：消除 svelte-ignore

### Phase 3：HTML 語義化（路由層）

11. **`EditorForm.svelte`**：`<div>` → `<form role="search">`
12. **`EditorList.svelte`**：卡片 `<div>` → `<button>`
13. **`EditorPagination.svelte`**：`<div>` → `<nav>` + ARIA

### Phase 4：複製至其他路由

14. `/scroll`：仿造 Phase 1 + Phase 3
15. `/trash`：仿造 Phase 1 + Phase 3
16. `/compare`：仿造 Phase 1（僅篩選條件，結構較簡單）

---

## 六、預計消除的技術債

| 類型 | 數量 | 說明 |
|------|------|------|
| `doSearch()` 重複實作 | 3 處 → 0 | editorForm / editorPagination / editorSelectionDock |
| `<!-- svelte-ignore -->` 壓制 | 4 處 → 0 | EditorList (2) + SelectCheckbox (2) |
| Client API 手動呼叫 | 3 處 → 0 | 全部由 SvelteKit `load` 接管 |
| Loading 狀態手動管理 | 3 處 timer 邏輯 → 1 處集中管理 | 由 SvelteKit `navigating` 或統一 `$effect` 處理 |

---

## 七、不改動的部分

以下項目明確**不在此次改造範圍**內：

- **`/editor/[id]` 子路由**：已經使用 route param，無需改動
- **Rating.svelte**：ARIA 已經完善（`role="spinbutton"` + 完整的 value 屬性），是此專案中語義化最好的元件
- **Context 系統本身**：架構不變，只是初始值來源和更新觸發方式改變
- **`$lib/utils.ts` 的 `parseQueryParams()`**：已經存在且在 `/browse/player` 中驗證過，直接復用
- **API 端點（`/api/images`）**：不需要修改，它已經在正確處理查詢參數
