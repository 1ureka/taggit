# Frontend 開發規範

> 本文件定義了專案的前端架構、元件開發規範與 Page 組織方式，確保 UI 開發保持一致性、可維護性與清晰的職責分工。

---

## 一、狀態

本章定義了所有響應式狀態的規則。無論狀態宣告在 `+page.svelte` 還是無頭 UI（`*.svelte.ts`），規則都相同——我們統稱為「狀態」。

### 1.1 狀態的宣告位置

本專案中，「狀態」指以 `$state` 宣告的響應式變數。狀態只允許出現在兩個地方：

1. **`+page.svelte`**——跨子元件共享的狀態
2. **無頭 UI 工廠函數（`*.svelte.ts`）**——僅該元件使用的狀態

**不得**在子元件的 `.svelte` 檔案中宣告 `$state`。同理，`$derived` 若涉及運算邏輯也應收進無頭 UI，`.svelte` 中的 `$derived` 僅限直覺的一行式轉換。

無論狀態宣告在哪裡，本章後續的所有規則都一體適用。關於 `+page.svelte` 與無頭 UI 各自的職責與檔案結構，詳見[第二章](#二page-組織與資料流)與第三章。

### 1.2 API 約束

狀態只能使用以下四個 API：

| API | 用途 |
|---|---|
| `$state` | 宣告可變響應式狀態 |
| `$derived` | 從既有響應式來源衍生唯讀值 |
| `$effect` | 監聽外部來源變動，同步回本地狀態 |
| `untrack` | 在 `$state` 初始化器中讀取外部來源的當下值，不建立追蹤 |

**禁用清單：**

以下 API **不得用於狀態管理**：

- `afterNavigate`——狀態同步一律使用 `$effect`
- `createContext` / `setContext` / `getContext`——不使用 Context API（詳見 [§2.6](#26-跨元件共享狀態)）
- Class-based state——不以 class 宣告 `$state`

### 1.3 狀態的兩個維度

狀態由兩個維度決定寫法：**讀寫需求**與**資料來源**。

#### 資料來源

| 來源 | 說明 |
|---|---|
| SSR `data` | `+page.server.ts` 回傳的 `data` 物件，透過 props 傳入 |
| URL params | `page.url.searchParams`，由需要的元件就近讀取 |
| 純本地 | 不來自外部，元件自身產生的狀態 |

SSR `data` 與 `page.url.searchParams` 本身就是 **read-only 的 reactive object**。

#### 寫法對照表

| 來源 | 唯讀 | 需要寫 |
|---|---|---|
| SSR `data` | `$derived` 或直接透過 props 使用 | `$state(untrack(...))` + `$effect` 同步 |
| URL params | `$derived(page.url.searchParams.get(...))` | `$state(untrack(...))` + `$effect` |
| 純本地 | `$derived` | `$state` |

**核心原則：如果你沒有「寫」的需求，直接 `$derived` 就好，不需要 `$state`、`$effect` 與 `untrack`。**

### 1.4 `untrack` 與 `$effect` 的角色

#### 問題

`$props()` 解構後的 `data` 是 reactive proxy，但若直接寫在 `$state()` 初始化器中：

```ts
// ✗ Svelte 警告：This reference only captures the initial value of 'data'.
let name = $state(data.image.name);
```

Svelte 會建立不必要的追蹤關係，且後續 `data` 更新時 `$state` 不會連動。

#### 解法

`untrack` 讓 `$state` 讀到外部來源的當下值，但不建立追蹤，再由 `$effect` 負責後續同步：

```ts
let name = $state(untrack(() => data.image.name));

$effect(() => {
  // data.image 變動時（invalidateAll / goto 導致 load 重跑），同步回本地
  name = data.image.name;
});
```

**`untrack` 解決了 SSR 後、`$effect` 執行前的真空問題**——沒有 `untrack`，`$state` 只能初始化為空值（`null` / `new Set()`），SSR 輸出的第一幀就是錯的。有了 `untrack`，`$state` 從第一幀就帶正確值，`$effect` 只負責後續的增量同步。

#### 簡單 vs 複雜場景

**簡單場景**——外部來源整個替換即可（如單一物件的欄位）：

```ts
let user = $state<User>(untrack(() => data.user));

$effect(() => {
  if (user.id !== data.user.id) user = data.user;
});
```

**複雜場景**——需要交叉校正多個狀態（如列表增減後調整選取）：

```ts
let currentFile = $state<string | null>(untrack(() => data.stagedFiles[0] ?? null));
let selectedFiles = $state<Set<string>>(untrack(() => {
  const first = data.stagedFiles[0];
  return first ? new Set([first]) : new Set();
}));

$effect(() => {
  const list = data.stagedFiles;

  // 第一幀由 untrack 處理，此處只處理後續變動

  // 波動 (N => N')
  if (currentFile !== null && list.length > 0) {
    if (!list.includes(currentFile)) currentFile = list[0];
    const next = new Set([...selectedFiles].filter((f) => list.includes(f)));
    if (next.size === 0) selectedFiles = new Set([currentFile]);
    else if (next.size !== selectedFiles.size) selectedFiles = next;
    return;
  }

  // 新增 (0 => N)
  if (currentFile === null && list.length > 0) {
    currentFile = list[0];
    selectedFiles = new Set([list[0]]);
    return;
  }

  // 清空 (N => 0)
  if (currentFile !== null && list.length <= 0) {
    currentFile = null;
    selectedFiles = new Set();
    return;
  }
});
```

`$effect` 內的 reconciliation 邏輯依實際需求設計，但初始值一律由 `untrack` 提供。

### 1.5 下放原則

`$effect` 若用於同步外部狀態，應宣告在**消費該狀態的位置**：

- 頁面級共享狀態的 `$effect` → 寫在 `+page.svelte`
- 無頭 UI 內部狀態的 `$effect` → 寫在 `*.svelte.ts` 的工廠函數內

比如若同一份外部資料有多個消費者，**只有需要「寫」的元件才走 `$state` + `untrack` + `$effect`**，其餘元件直接透過 `$props` 原封不動使用即可。

**範例**：頁面有 A、B、C 三個子元件都需要 `data.image` (SSR)，但只有 C 需要編輯：

```svelte
<!-- +page.svelte -->
<A image={data.image} />        <!-- A 唯讀：直接用 props -->
<B image={data.image} />        <!-- B 唯讀：直接用 props -->
<C image={data.image} bind:loading />  <!-- C 需要寫 -->
```

```ts
// c.svelte.ts — 只有 C 的無頭 UI 才需要 $state + untrack + $effect
export function createC(options: COptions) {
  let name = $state(untrack(() => options.image.name));
  let tags = $state<string[]>(untrack(() => [...options.image.tags]));

  $effect(() => {
    name = options.image.name;
    tags = [...options.image.tags];
  });

  // ...
}
```

A、B 元件的無頭 UI 直接從 `options.image`（getter）讀取即可，不建立自己的 `$state` 副本。

### 1.6 輸入 debounce

**多數情況不需要 debounce。** 若變更是離散選擇（select、checkbox、按鈕切換等），不需要本節的 `dirty` 機制——同步完成後 `$effect` 偵測到外部來源變動會同步回本地，但本地值已是最新的，同步是冪等的：

```ts
$effect(() => {
    const q = page.url.searchParams.get("sort") ?? "default";
    sort = q;
});

function handleFilterChange() {
  goto(`/search${buildQueryString({ sort })}`, { replaceState: true, noScroll: true, keepFocus: true });
}
```

#### 何時需要 debounce

只有**連續輸入**（如文字搜尋框）才需要 debounce。此時存在一個競態：debounce 到期 → 同步送出 → 使用者在同步回來前又輸入了新值。

使用 `dirty` flag 區分 source of truth。**`dirty` 在 `$effect` 中必須以 `untrack` 讀取**——否則 `dirty` 本身的變動會觸發 `$effect` 重跑，此時外部來源可能尚未更新，導致舊值覆蓋使用者的新輸入：

```ts
export function createSearchForm() {
  let dirty = $state(false);
  let search = $state(untrack(() => page.url.searchParams.get("q") ?? ""));

  $effect(() => {
    const q = page.url.searchParams.get("q") ?? "";  // 追蹤外部來源
    if (untrack(() => dirty)) return;                 // 本地正在修改，跳過
    search = q;
  });

  let timer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    search = (e.target as HTMLInputElement).value;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      goto(`/search?q=${encodeURIComponent(search)}`, { replaceState: true, noScroll: true, keepFocus: true });
      dirty = false;                                  // 送出，交回外部來源（不 await goto）
    }, 300);
  }

  // ...
}
```

#### 時序

1. 使用者輸入 → `dirty = true`，本地狀態更新
2. debounce 到期 → `goto()` 送出 → **立刻** `dirty = false`
3. `$effect` 偵測到外部來源變動：
   - `dirty === false` → 正常同步（這次的同步或 popstate 回來了）
   - `dirty === true` → 跳過（使用者在同步回來前又輸入了新值，舊值不該覆蓋）

#### 為什麼 `dirty` 要用 `untrack`？

若 `$effect` 追蹤 `dirty`，當 `dirty` 從 `true` 變為 `false`（`goto()` 送出後）時 `$effect` 會立刻重跑——但此時 `goto()` 是非同步的，外部來源尚未更新，`$effect` 會把**舊值**同步回本地，覆蓋使用者的新輸入。`untrack` 確保 `$effect` 只在外部來源真正變動時才觸發。

### 1.7 載入 debounce

當使用者觸發導航（`goto()` / `invalidateAll()`），SvelteKit 的 `navigating.to` 會在導航期間變為非 `null`。若立刻顯示載入狀態，快速完成的導航（< 200ms）會造成內容閃爍。

本專案採用**純 CSS `transition-delay`** 取代 JavaScript 計時器，以零邏輯開銷實現載入提示的 debounce：

```svelte
<div class="container" style:opacity={navigating.to ? 0.4 : 1}>
  <!-- 正常內容 -->
</div>

<style>
  .container {
    transition: opacity 0s step-end 0.2s;
  }
</style>
```

**`transition: opacity 0s step-end 0.2s` 的三個值：**

| 值 | 意義 |
|---|---|
| `0s` | duration——opacity 變化是瞬間跳變，不做漸變 |
| `step-end` | timing function——離散跳變（與 `0s` 搭配確保行為明確） |
| `0.2s` | delay——opacity 變化延遲 200ms 才生效 |

若導航在 200ms 內完成，`opacity` 已回到 `1`，瀏覽器**自動取消尚未生效的 pending transition**——不需要任何 JavaScript 清理邏輯，天然無競態。

此模式不限於 `navigating`——任何布林旗標驅動的暫態視覺回饋（如 API 呼叫中的 `loading`）都適用，只要希望「短暫切換不產生視覺變化、長時間停留才顯示」。

---

## 二、Page 組織與資料流

本章定義頁面層的結構與資料流方向。狀態的具體寫法已在第一章規範，本章聚焦於**東西放在哪裡、怎麼流動**。

### 2.1 `+page.svelte` — 職責定義

`+page.svelte` 是頁面殼。它的職責僅限：

- 接收 SSR `data`
- 宣告頁面級共享狀態（含 `$effect` 同步校正，見 [§1.4](#14-untrack-與-effect-的角色)）
- 組裝子元件並以 props / `bind` 傳遞資料
- 佈局樣式（如 `height`、`overflow`、`grid-template`）

**不得**包含：事件處理（event handler）、UI 衍生計算、模板內的條件業務判斷。

即便頁面極其簡單（僅一個表單），仍須將 UI 抽出為至少一個子元件。

### 2.2 元件的檔案結構與無頭 UI

含有互動邏輯的元件由**兩個檔案**組成：

```
ComponentName.svelte       ← 結構 + 樣式（<template> + <style>）
componentName.svelte.ts    ← 無頭 UI（純邏輯，不含任何 HTML/CSS）
```

無頭 UI 以工廠函數（`createXxx`）形式撰寫，接收 `options` 物件、以 `$state` / `$derived` 管理內部狀態、回傳 `ui` 物件供 `.svelte` 使用。

**例外**：若元件完全沒有 handler、`$state`、`$derived` 或 `$effect`（純展示），只需 `*.svelte` 一個檔案。

**結果**：當所有邏輯都收進無頭 UI 後，`.svelte` 的 `<script>` 極其乾淨——只做 props 解構與工廠函數呼叫，模板只使用 `ui.*`：

```svelte
<script lang="ts">
  type Props = { value?: string; onchange?: () => void };
  let { value = $bindable(""), onchange }: Props = $props();

  const ui = createComponent({
    get value() { return value; },
    set value(v) { value = v; },
    onchange: () => onchange?.(),
  });
</script>

<input value={ui.displayValue} oninput={ui.handleInput} />
<button onclick={ui.handleSubmitClick}>{ui.buttonLabel}</button>
```

**樣式**：不推薦將樣式單獨提取為 `.css`，透過無頭 UI， `.svelte` 是純 view，請直接利用元件的 `<style>` 塊自帶 scoped 作用域來避免全局污染。

模板中不應出現任何業務判斷或脫離 `ui` 的狀態計算。工廠函數的完整編排規範（options 設計、handler 命名、程式碼排列順序、JSDoc 寫法等）詳見第三章。

### 2.3 共用元件

所有共用元件位於 `src/lib/components`（`.svelte`）與 `src/lib/ui`（`.svelte.ts`）兩個資料夾。

- 部分 `.svelte` 是純展示或容器元件，沒有對應的 `.svelte.ts`。
- 部分 `.svelte.ts` 是獨立的無頭 UI 工廠函數，沒有對應的 `.svelte`（如 `src/lib/ui/menu.svelte.ts` 的 `createMenu`）。

**任何新功能或大更新時，都必須先檢視這兩個資料夾的內容**，避免重複造出已存在的元件或工廠函數。

### 2.4 SSR `data` 的傳遞

`+page.server.ts` 負責查詢資料庫、組裝回傳的 `data` 物件，**不含任何 UI 邏輯**。

**命名慣例：** SSR 的資料變數不得使用 `initial`、`preload` 等詞彙，應使用純粹的名稱（如 `total`、`count`、`items`）。

`data` 由 `+page.svelte` 接收後，**直接透過 props 傳給子元件**，不額外中轉。`data` 是 `$props()` 的一部分，Svelte 自動追蹤其變更——`goto()` 或 `invalidateAll()` 導致 `load` 重跑後，props 自動更新，子元件響應式重繪。

### 2.5 URL 狀態的取用

URL query params（如 `?tab=xxx`、`?sort=name`）應由**需要讀取的元件就近獲取**，不從上層以 props 傳入：

- **唯讀**：直接在 `.svelte` 的 `<script>` 中以 `$derived` 從 `page.url.searchParams` 讀取。
- **讀寫**：在無頭 UI（`*.svelte.ts`）中以 `$state(untrack(...))` + `$effect` 同步（見 [§1.3](#13-狀態的兩個維度)、[§1.6](#16-輸入-debounce)）。

```svelte
<!-- 唯讀示例：元件自行從 URL 讀取 -->
<script lang="ts">
  import { page } from "$app/state";
  const tab = $derived(page.url.searchParams.get("tab") ?? "default");
</script>
```

使用 `goto()` 時，要記得三個重要選項 `{ replaceState, noScroll, keepFocus }`，確保 URL 更新不會干擾使用者體驗。

### 2.6 跨元件共享狀態

若多個子元件需要共享響應式狀態（如 `selected`），在 `+page.svelte` 中以 `$state` 宣告，再透過 props / `bind` 傳給子元件：

```svelte
<script lang="ts">
  let { data } = $props();
  let selected = $state<Set<string>>(new Set());
</script>

<EditorList items={data.result.items} bind:selected />
<EditorSelectionDock bind:selected />
```

**不使用 Context API（`createContext` / `setContext` / `getContext`）：**

本專案所有路由的子元件皆只有一到兩層深度（不計共用元件），props / `bind` 足以覆蓋所有跨元件共享需求。資料流永遠只有一個 pattern：**props 向下、`bind` 向上、getter/setter options 傳入無頭 UI**。

### 2.7 跨元件共享非響應式引用

若多個子元件需要共享**非響應式引用**（如 timer ID、AbortController 等協調用物件），在 `+page.svelte` 建立普通物件，以 prop 傳下去即可。JS 物件是 pass-by-reference，所有子元件操作的是同一塊記憶體：

```svelte
<!-- +page.svelte -->
<script lang="ts">
  const timers = {
    loading: null as ReturnType<typeof setTimeout> | null,
    search: null as ReturnType<typeof setTimeout> | null,
  };
</script>

<EditorForm {timers} ... />
<EditorPagination {timers} ... />
```

這類引用不需要驅動 UI 重繪，因此**刻意不用 `$state`**，沒有響應式開銷。

### 2.8 機制與策略分離

當一個元件的 props 列表膨脹時，通常代表它混入了**不屬於自身核心職責**的邏輯。判斷的方式是區分**機制（mechanism）**與**策略（policy）**：

- **機制**：元件之所以存在的核心運作原理——移除後元件無法運作的部分。
- **策略**：呼叫者針對該機制所注入的具體行為決策——移除後元件的核心機制仍可獨立運作。

**判斷方法：「如果移除這個 prop，元件的核心機制還能運作嗎？」** 若能，它就是策略，應透過 callback prop 或 Svelte snippet 交由呼叫者注入，而非作為資料 props 傳入。

以虛擬化列表為例：

| 分類 | Props / 參數 | 理由 |
|---|---|---|
| 機制 | `itemCount`、`itemHeight`、`overScan` | 移除後列表無法計算可見範圍，核心不成立 |
| 策略 | `renderItem`、`onItemClick`、`selectedIds` | 移除後列表仍可捲動並定位可見項目，只是什麼都不渲染、不回應互動 |

遵循此原則後，元件的 props 介面只包含機制配置與策略注入口（callback / snippet），不再出現「轉交型 props」——那些元件本身不消費、只是為了餵給 callback 內部邏輯而存在的資料。

```svelte
<VirtualList {itemCount} {itemHeight}>
  {#snippet renderItem(index, style)}
    <div {style}>{items[index].name}</div>
  {/snippet}
</VirtualList>
```

### 2.9 Prop Drilling 處理

當開發者遇到 prop drilling 時，請依序嘗試以下四種方案：

1. **提取成 URL query**（如 `?tab=xxx`），讓子元件直接在 `*.svelte.ts` 從 `page.url.searchParams` 讀取
2. **重新審視元件介面邊界**——若元件接收了大量非其核心機制所需的 props，以 callback / snippet 重構介面，將策略交還呼叫者
3. **拆分路由結構**——將該路由本身拆成多個子路由，或重新組織子元件
4. **提取共用元件**——從而在心智上不再認為多一層級

> **AI Agent 注意：** 當你注意到需要執行上述方案之一，甚至完全無法解決 prop drilling 時，請停止目前的開發，並向人類開發者提出「我遇到了 prop drilling 問題，已嘗試以下方案但無法解決：...，請協助重新組織路由結構或提取共用元件」的訊息。

---

## 三、元件開發規範

本章定義無頭 UI 工廠函數（`createXxx`）的具體實作規範，包括 options 設計、handler 命名、程式碼排列順序與 JSDoc 寫法。元件的檔案結構與概念介紹詳見 [§2.2](#22-元件的檔案結構與無頭-ui)。

### 3.1 工廠函數模式

無頭 UI 以**工廠函數**（`createXxx`）形式撰寫，遵循以下三個原則：

1. **接收 `options` 物件**——雙向綁定的 prop 以 getter/setter 傳入，確保無頭 UI 內部讀取到的永遠是最新值；狀態規則統一遵循第一章。
2. **以 `$state` / `$derived` 管理內部狀態**——工廠函數頂層即可直接使用 runes（因副檔名為 `.svelte.ts`）。
3. **回傳 `ui` 物件**——僅暴露 `.svelte` 需要用到的成員：狀態以 getter 形式回傳，事件處理一律以 `handle*` 命名（詳見 [§3.4](#34-handler-命名規範)）。

**工廠函數骨幹：**

```ts
// componentName.svelte.ts

/**
 * 元件配置選項
 */
type ComponentOptions = {
  /** 雙向綁定：目前的值 */
  value: string;
  /** 當值變更時觸發的回調 */
  onchange?: (v: string) => void;
};

/**
 * 建立元件邏輯的核心工廠函數
 */
export function createComponent(options: ComponentOptions) {
  /** 內部開關狀態 */
  let open = $state(false);

  // ---

  /** 處理觸發器點擊事件，切換開關狀態並觸發回調 */
  function handleTriggerClick() {
    open = !open;
    options.onchange?.(options.value);
  }

  // ---

  return {
    /** 存取開關狀態的 getter */
    get open() {
      return open;
    },
    /** 處理觸發器點擊事件，切換開關狀態並觸發回調 */
    handleTriggerClick,
  };
}
```

### 3.2 Options 設計

Options 物件的屬性分三種類型：

| 類型 | 說明 | 傳入寫法 |
|---|---|---|
| 雙向綁定 | `.svelte` 的 `$bindable` prop，無頭 UI 需要讀寫 | `get value() { return value; }` + `set value(v) { value = v; }` |
| 唯讀 prop | 來自父元件、無頭 UI 只需讀取 | `get items() { return items; }` |
| Callback | 事件觸發時通知父元件的函式 | `onchange: () => onchange?.()` |

**`.svelte` 的完整傳入範例：**

```svelte
<script lang="ts">
  type Props = {
    items: ImageWithId[];
    selected: Set<string>;
    onchange?: () => void;
  };
  let { items, selected = $bindable(new Set()), onchange }: Props = $props();

  const ui = createEditorList({
    get items() { return items; },
    get selected() { return selected; },
    set selected(v) { selected = v; },
    onchange: () => onchange?.(),
  });
</script>
```

**注意：** options 是 getter 物件，Svelte rune 系統能正確追蹤 getter 的回傳值，因此無頭 UI 內部任何地方讀 `options.items` 都能響應式地取得最新值，不需要再包 `$state` 副本——除非該元件「需要寫」（詳見 [§1.5](#15-下放原則)）。

### 3.3 Handlers

永遠不得直接 return helper function，就算只包一層，也應該包好後再 return：

```ts
// ✗ 直接 return helper
return {
  handleTriggerClick: toggleOpen,
};

// ✓ 包一層
function handleTriggerClick() {
  toggleOpen();
}

return {
  handleTriggerClick,
};
```

### 3.4 Handler 命名規範

Handler 一律採 `handle` + `目標元素` + `事件類型` 結構：

| Handler | 目標元素 | 事件類型 |
|---|---|---|
| `handleInput` | input | input |
| `handleInputFocus` | input | focus |
| `handleInputBlur` | input | blur |
| `handleInputKeydown` | input | keydown |
| `handleChipClick` | chip | click |
| `handleDropdownMouseDown` | dropdown | mousedown |
| `handleDropdownMouseOver` | dropdown | mouseover |
| `handleTriggerClick` | trigger | click |
| `handleTriggerBlur` | trigger | blur |
| `handleTriggerKeydown` | trigger | keydown |
| `handleOptionMouseDown` | option | mousedown |
| `handleOptionMouseEnter` | option | mouseenter |
| `handleItemMouseDown` | item | mousedown |
| `handleItemMouseEnter` | item | mouseenter |
| `handleStarMouseEnter` | star | mouseenter |
| `handleStarClick` | star | click |
| `handleContainerMouseLeave` | container | mouseleave |
| `handleContainerKeydown` | container | keydown |

### 3.5 程式碼編排

工廠函數內部以 `// ---` 作為視覺段落分隔符，依固定順序排列：

```ts
export function createXxx(options: XxxOptions) {
  // ① $state 宣告（含 JSDoc）
  let stateA = $state(...);
  let stateB = $state(...);

  // ② $derived 宣告（含 JSDoc）
  const derivedC = $derived(...);

  // ---

  // ③ 常數（如選項列表）
  const OPTIONS = [...];

  // ---

  // ④ Private helper functions（不回傳的內部函式）
  function doSomething() { /* ... */ }
  function openDropdown() { /* ... */ }
  function closeDropdown() { /* ... */ }

  // ---

  // ⑤ Handler functions（按目標元素分組，組間以 // --- 分隔）
  function handleTriggerClick() { /* ... */ }
  function handleTriggerBlur() { /* ... */ }
  function handleTriggerKeydown(e: KeyboardEvent) { /* ... */ }

  // ---

  function handleOptionMouseDown(e: MouseEvent, item: SelectItem) { /* ... */ }
  function handleOptionMouseEnter(index: number) { /* ... */ }

  // ---

  // ⑥ 可選：$effect（放在 handler 之後）

  // ---

  // ⑦ Return 物件（getter/setter 在前，handler 在後）
  return {
    // DOM ref getter/setter
    get triggerEl() { ... },
    set triggerEl(el) { ... },

    // 狀態 getter
    get open() { ... },
    get activeIndex() { ... },
    get selectedLabel() { ... },

    // Handler references
    handleTriggerClick,
    handleTriggerBlur,
    handleTriggerKeydown,
    handleOptionMouseDown,
    handleOptionMouseEnter,
  };
}
```

**要點：**

- `// ---` 是唯一使用的分隔符，不使用 `// ===` 或 `// ───` 等其他變體。
- 同一目標元素的 handler 連續排列，不加分隔符（如 `handleTriggerClick` / `handleTriggerBlur` / `handleTriggerKeydown`）。
- 不同目標元素的 handler 之間以 `// ---` 分隔。
- return 物件中：先 DOM ref getter/setter，再狀態 getter，最後 handler reference（與定義順序一致）。

### 3.6 JSDoc 寫法

所有無頭 UI（`*.svelte.ts`）都遵循統一的 JSDoc 寫法。

**Type 定義**

- Type alias（無屬性）使用**單行** JSDoc：

```ts
/** 排序欄位類型 */
type Sort = "committedAt" | "rating" | "name" | "random";
```

- Options type 與 factory function 使用**多行** JSDoc：

```ts
/**
 * 下拉選單的配置選項
 */
type SelectOptions = {
  /** 雙向綁定：目前選中的值 */
  value: string | number | undefined;
  /** 選項列表 */
  list: SelectItem[];
  /** 當選項變更時觸發的回調 */
  onchange?: (value: string | number | undefined) => void;
};

/**
 * 建立下拉選單邏輯的核心工廠函數
 */
export function createSelect(options: SelectOptions) {
```

Options 屬性一律**單行** JSDoc，雙向綁定的屬性以 `/** 雙向綁定：描述 */` 開頭。

**`$state` / `$derived` 宣告**

每個 `$state` 或 `$derived` 變數上方加**單行** JSDoc：

```ts
/** 觸發器按鈕的 DOM 引用 */
let triggerEl = $state<HTMLButtonElement>();
/** 下拉選單是否開啟 */
let open = $state(false);
/** 目前「虛擬聚焦」的選項索引 */
let activeIndex = $state(-1);

/** 根據目前 options.value 找到對應的 label */
const selectedLabel = $derived(options.list.find((item) => item.value === options.value)?.label ?? "");
```

**Private helper functions**

使用**單行** JSDoc 描述行為：

```ts
/** 執行選取動作並觸發 onchange 回調 */
function selectOption(item: SelectItem) { /* ... */ }

/** 開啟選單，虛擬聚焦至當前已選中項，若無則為 -1 */
function openDropdown() { /* ... */ }

/** 關閉選單，重置虛擬聚焦索引 */
function closeDropdown() { /* ... */ }
```

**Handler functions**

使用**單行** JSDoc，格式為 `處理 [目標元素] [事件類型]事件，[具體行為]`：

```ts
/** 處理 Trigger 點擊事件，切換下拉選單的開啟/關閉狀態 */
function handleTriggerClick() { /* ... */ }

/** 處理 Trigger 失焦事件，關閉下拉選單 */
function handleTriggerBlur() { /* ... */ }

/** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
function handleTriggerKeydown(e: KeyboardEvent) { /* ... */ }
```

鍵盤 handler 內部的各 branch 也以單行 JSDoc 標註：

```ts
function handleInputKeydown(e: KeyboardEvent) {
  /** 按下 Escape 且下拉選單顯示時，關閉下拉選單 */
  if (e.key === "Escape" && showDropdown) {
    closeDropdown();
    return;
  }

  /** 按下 Backspace 且輸入框為空時，刪除最後一個標籤 */
  if (e.key === "Backspace" && !inputValue) {
    popTag();
    return;
  }
}
```

**Return 物件**

return 物件中的每個成員都**重複**其定義處的同一份 JSDoc（不省略）：

```ts
return {
  /** 獲取 Trigger 元素的 getter */
  get triggerEl() {
    return triggerEl as HTMLButtonElement;
  },
  /** 設定 Trigger 元素的 setter */
  set triggerEl(el: HTMLButtonElement) {
    triggerEl = el;
  },

  /** 存取下拉選單狀態的 getter */
  get open() {
    return open;
  },
  /** 存取虛擬聚焦索引的 getter */
  get activeIndex() {
    return activeIndex;
  },

  /** 處理 Trigger 點擊事件，切換下拉選單的開啟/關閉狀態 */
  handleTriggerClick,
  /** 處理 Trigger 失焦事件，關閉下拉選單 */
  handleTriggerBlur,
  /** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
  handleTriggerKeydown,
};
```

getter JSDoc 慣用語：`獲取 XXX 的 getter` 或 `存取 XXX 的 getter`。
setter JSDoc 慣用語：`設定 XXX 的 setter` 或 `設置 XXX 的 setter`。
