# Components & Page 開發規範

> 本章節定義了專案的元件開發規範與頁面組織架構，確保團隊在構建 UI 時保持一致性、可維護性與清晰的職責分工。

---

## 一、架構概覽

本專案的 UI 開發圍繞兩個核心規則：

1. **每個有 UI 表現的元件，都必須拆為一對檔案**：`*.svelte`（結構 + 樣式）與 `*.svelte.ts`（無頭 UI 邏輯）。
2. **每個路由，無論多麼簡單，`+page.svelte` 都至少委託一個子元件**——頁面層只做資料接收、context 注入、子元件組裝。

---

## 二、共用元件（N + 1）

### 2.1 概覽

| 元件                  | Svelte 封裝                                     | 無頭 UI                                                    | 說明                                      |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `Autocomplete`        | `src/lib/components/Autocomplete.svelte`        | `src/lib/client/autocomplete.svelte.ts`                    | 多標籤輸入，含下拉補全                    |
| `AutocompleteCompact` | `src/lib/components/AutocompleteCompact.svelte` | `src/lib/client/autocomplete.svelte.ts` + `menu.svelte.ts` | 緊湊版，多餘標籤收入 overflow popover     |
| `Select`              | `src/lib/components/Select.svelte`              | `src/lib/client/select.svelte.ts`                          | 單選下拉選單，保有已選狀態                |
| `Rating`              | `src/lib/components/Rating.svelte`              | `src/lib/client/rating.svelte.ts`                          | 五星評分，支援唯讀模式                    |
| `createMenu`          | **（無 Svelte 封裝）**                          | `src/lib/client/menu.svelte.ts`                            | 純無頭 UI 選單，用於一次性操作 / 導航收納 |

「N + 1」中的 **1** 即 `createMenu`——它僅提供無頭 UI factory，沒有對應的 `.svelte` 封裝元件，消費者需自行在目標元件的模板中組裝觸發器與項目清單。`AutocompleteCompact` 即是一個直接消費 `createMenu` 的例子。

---

### 2.2 Autocomplete

**Props**

| Prop          | 型別                | 預設值          | 說明                                       |
| ------------- | ------------------- | --------------- | ------------------------------------------ |
| `tags`        | `string[]`          | `[]`            | `$bindable`：目前選中的標籤                |
| `placeholder` | `string`            | `"輸入標籤..."` | 輸入框佔位符                               |
| `variant`     | `"top" \| "inline"` | `"top"`         | 版面配置，`"inline"` 使 chip 與 input 同行 |
| `onenter`     | `() => void`        | —               | 空輸入按 Enter 時觸發（例：提交）          |
| `onchange`    | `() => void`        | —               | 標籤新增或移除時觸發                       |

> **注意**：緊湊版請改用 `AutocompleteCompact`，後者額外支援 `maxVisible` 限制可見 chip 數量。

**用法範例**

```svelte
<Autocomplete
  bind:tags={ui.tags}
  variant="top"
  placeholder="添加標籤..."
  onchange={ui.handleTagChange}
/>
```

---

### 2.3 Select

**Props**

| Prop       | 型別                            | 預設值      | 說明                              |
| ---------- | ------------------------------- | ----------- | --------------------------------- |
| `value`    | `string \| number \| undefined` | `undefined` | `$bindable`：目前選中值           |
| `options`  | `SelectItem[]`                  | `[]`        | 選項列表，`{ value, label }` 格式 |
| `size`     | `"sm" \| "md"`                  | `"sm"`      | 按鈕尺寸                          |
| `stretch`  | `boolean`                       | `false`     | 是否撐滿容器寬度                  |
| `onchange` | `() => void`                    | —           | 選項變更時觸發                    |

**用法範例**

```svelte
<Select
  bind:value={ui.sort}
  options={ui.sortOptions}
  size="md"
  stretch
/>
```

---

### 2.4 Rating

**Props**

| Prop       | 型別                  | 預設值      | 說明                         |
| ---------- | --------------------- | ----------- | ---------------------------- |
| `value`    | `number`              | `0`         | `$bindable`：0–5，0 = 未評分 |
| `size`     | `string`              | `"1.25rem"` | 星號大小（CSS rem 長度字串） |
| `readonly` | `boolean`             | `false`     | 唯讀模式（純展示，不可互動） |
| `onchange` | `(v: number) => void` | —           | 分數變更時觸發               |

**用法範例**

```svelte
<!-- 互動模式 -->
<Rating bind:value={ui.rating} size="1.5rem" onchange={ui.handleRatingChange} />

<!-- 唯讀展示 -->
<Rating value={item.rating} readonly />
```

---

### 2.5 createMenu（純無頭 UI）

`createMenu` 不提供任何 UI，呼叫者需自行渲染觸發器與選單項目，並將 factory 回傳的事件處理器綁到對應的 DOM 元素上。

**配置選項**

| 選項               | 型別             | 說明                                              |
| ------------------ | ---------------- | ------------------------------------------------- |
| `list`             | `MenuItem[]`     | 選單項目（`{ value, label }`），支援響應式 getter |
| `onselect`         | `(item) => void` | 使用者選取項目時觸發（不保存狀態）                |
| `disableAutoClose` | `boolean`        | 選取後是否不自動關閉（預設 `false`，即自動關閉）  |

**與 Select 的差異**

`createSelect` 保存「目前已選中值」狀態；`createMenu` **不保存**選取狀態，適合導航跳轉、一次性操作收納等場景。

**使用範例（inline，不另開元件）**

```svelte
<script lang="ts">
  import { createMenu } from "$lib/client/menu.svelte.js";

  const menu = createMenu({
    list: [
      { value: "edit", label: "編輯" },
      { value: "delete", label: "刪除" },
    ],
    onselect: (item) => console.log(item.value),
  });
</script>

<button
  bind:this={menu.triggerEl}
  onclick={menu.handleTriggerClick}
  onblur={menu.handleTriggerBlur}
  onkeydown={menu.handleTriggerKeydown}
>
  操作
</button>

{#if menu.open}
  <div role="listbox">
    {#each menu.list as item, i}
      <button
        role="option"
        class:active={i === menu.activeIndex}
        aria-selected={i === menu.activeIndex}
        onmousedown={(e) => menu.handleItemMouseDown(e, item)}
        onmouseenter={() => menu.handleItemMouseEnter(i)}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}
```

---

## 三、Page 開發規範

### 3.1 職責分工

| 層級     | 檔案                                               | 職責                                                            |
| -------- | -------------------------------------------------- | --------------------------------------------------------------- |
| SSR 資料 | `+page.server.ts`                                  | 查詢資料庫，回傳 `data` 物件；**不含任何 UI 邏輯**              |
| 頁面殼   | `+page.svelte`                                     | 接收 `data`、初始化 context（若需要）、組裝子元件並傳入初始資料 |
| 子元件   | `ComponentName.svelte` + `componentName.svelte.ts` | 負責該頁面的所有 UI 邏輯與樣式                                  |

### 3.2 規則

- `+page.svelte` **不含業務邏輯、樣式規則只允許布局上的**，僅做「接收 → 分發」。
- 即便頁面極其簡單（僅一個表單），仍須將 UI 抽出為至少一個子元件。
- 若跨元件需要共享響應式狀態，於 `+page.svelte` 呼叫 `setMyContext(new MyContext())` 注入，子元件以 `getMyContext()` 取用，詳見 [context.md](./context.md)。

### 3.3 範例（`/browse` 路由）

```
src/routes/browse/
├── +page.server.ts   ← SSR：預查總數，回傳 { initialCount }
├── +page.svelte      ← 接收 data，傳入 <Form>，僅有 <main> 殼層樣式
├── Form.svelte       ← 篩選表單 UI（結構 + 樣式）
└── form.svelte.ts    ← 表單邏輯（無頭 UI）
```

**`+page.server.ts`**

```ts
// SSR: 以預設篩選條件預查總數，免去頁面載入後的第一次 client 查詢
export const load: PageServerLoad = () => {
  const db = getDB();
  const result = queryImages(db, { limit: 1 });
  return { initialCount: result.total };
};
```

**`+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import Form from "./Form.svelte";

  let { data }: { data: PageData } = $props();
</script>

<main class="page">
  <Form matchCount={data.initialCount} />
</main>

<style>
  main.page {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }
</style>
```

`+page.svelte` 除了 `<main>` 的殼層樣式外，業務邏輯全在 `Form.svelte` / `form.svelte.ts` 中。

---

## 四、元件開發規範

### 4.1 檔案結構

每個元件恰好由**兩個檔案**組成：

```
ComponentName.svelte       ← 結構 + 樣式（<template> + <style>）
componentName.svelte.ts    ← 無頭 UI（純邏輯，不含任何 HTML/CSS）
```

**不推薦**將樣式單獨提取為 `.css` 檔案——元件的 `<style>` 塊已自帶 scoped 作用域，與結構並存更易維護。

### 4.2 無頭 UI（`*.svelte.ts`）

無頭 UI 以**工廠函數**（`createXxx`）形式撰寫，遵循以下模式：

1. **接收 `options` 物件**，其中雙向綁定的 prop 需暴露為 getter/setter pair（以承接 Svelte 5 的 reactive proxy）；callbacks 直接放在 options 中。
2. **以 `$state` / `$derived` 管理內部狀態**，工廠函數頂層即可直接使用 runes（因副檔名為 `.svelte.ts`）。
3. **回傳 `ui` 物件**，僅暴露 `.svelte` 需要用到的：
   - 狀態以 getter 形式暴露（必要時附 setter）
   - 事件處理一律以 `handle*` 命名

**工廠函數模式骨幹**

```ts
// componentName.svelte.ts
type ComponentOptions = {
  value: string; // 雙向綁定的值
  onchange?: (v: string) => void; // callback
};

export function createComponent(options: ComponentOptions) {
  let internalState = $state(false);

  function handleSomethingClick() {
    internalState = !internalState;
    options.onchange?.(options.value);
  }

  return {
    get internalState() {
      return internalState;
    },
    handleSomethingClick,
  };
}
```

### 4.3 Svelte 封裝（`*.svelte`）

`.svelte` 的 `<script>` 只做兩件事：

1. 宣告 `Props` 型別並以 `$props()` 解構
2. 呼叫工廠函數，將 bindable props 以 getter/setter proxy 傳入

**雙向綁定的傳入慣例**

```svelte
<script lang="ts">
  type Props = { value?: string; onchange?: () => void };
  let { value = $bindable(""), onchange }: Props = $props();

  const ui = createComponent({
    onchange: () => onchange?.(),
    get value() { return value; },
    set value(v) { value = v; },
  });
</script>
```

之後模板只需使用 `ui.*` 即可，不應在模板中加入任何業務判斷或脫離 `ui` 的狀態計算。

### 4.4 參考實作

- **`autocomplete.svelte.ts`**（`src/lib/client/autocomplete.svelte.ts`）：完整展示 `$state`、`$derived.by`、多個 handler、開關選單生命週期、響應式 getter/setter options 傳遞的最佳範例。
- **`select.svelte.ts`**（`src/lib/client/select.svelte.ts`）：展示 `activeIndex` 虛擬聚焦、鍵盤導航完整實作（Tab / Arrow / Enter / Space / Escape）、以及 blur → closeDropdown 的焦點管理模式。

### 4.5 JSDoc 寫法規範

所有無頭 UI（`*.svelte.ts`）都遵循統一的 JSDoc 寫法。以下規則從 `autocomplete.svelte.ts`、`select.svelte.ts`、`rating.svelte.ts`、`menu.svelte.ts` 四個參考實作歸納而得。

#### Type 定義

- **Type alias**（無屬性）使用**單行** JSDoc：

```ts
/** 排序欄位類型 */
type Sort = "committedAt" | "rating" | "originalName" | "random";
```

- **Options type** 與 **factory function** 使用**多行** JSDoc：

```ts
/**
 * 下拉選單組件的配置選項
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

Options 屬性一律**單行** JSDoc。雙向綁定的屬性以 `/** 雙向綁定：描述 */` 開頭。

#### `$state` / `$derived` 宣告

每個 `$state` 或 `$derived` 變數上方加**單行** JSDoc：

```ts
/** 觸發器按鈕實例的引用 (DOM) */
let triggerEl = $state<HTMLButtonElement>();
/** 下拉選單是否開啟 */
let open = $state(false);
/** 下拉選單中目前「虛擬聯焦」的選項索引 */
let activeIndex = $state(-1);

/** 根據目前 options.value 找到對應的 label */
const selectedLabel = $derived(options.list.find((item) => item.value === options.value)?.label ?? "");
```

#### Private helper functions

使用**單行** JSDoc 描述行為：

```ts
/** 執行選取動作 */
function selectOption(item: SelectItem) { /* ... */ }

/** 開啟選單，預設虛擬聚焦到當前已選中的那一個，若無則為 -1 */
function openDropdown() { /* ... */ }

/** 關閉選單，重置虛擬聚焦索引 */
function closeDropdown() { /* ... */ }
```

#### Handler functions

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
  /** 當按下 Escape 鍵且下拉選單顯示時，關閉下拉選單 */
  if (e.key === "Escape" && showDropdown) {
    closeDropdown();
    return;
  }

  /** 當按下 Backspace 鍵且輸入框為空時，刪除最後一個標籤 */
  if (e.key === "Backspace" && !inputValue) {
    popTag();
    return;
  }
}
```

#### Return 物件

return 物件中的每個成員都**重複**其定義處的同一份 JSDoc（不省略）：

```ts
return {
  /** 獲取 Trigger 元素的 getter */
  get triggerEl() {
    return triggerEl as HTMLButtonElement;
  },
  /** 設定 Trigger 元素 setter */
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

### 4.6 Handler 命名規範

Handler 一律採 `handle` + `目標元素` + `事件類型` 結構，以下為參考實作中的命名範例：

| Handler                      | 目標元素    | 事件類型         | 來源                   |
| ---------------------------- | ----------- | ---------------- | ---------------------- |
| `handleInput`                | input       | input            | autocomplete.svelte.ts |
| `handleInputFocus`           | input       | focus            | autocomplete.svelte.ts |
| `handleInputBlur`            | input       | blur             | autocomplete.svelte.ts |
| `handleInputKeydown`         | input       | keydown          | autocomplete.svelte.ts |
| `handleChipClick`            | chip        | click            | autocomplete.svelte.ts |
| `handleDropdownMouseDown`    | dropdown    | mousedown        | autocomplete.svelte.ts |
| `handleDropdownMouseOver`    | dropdown    | mouseover        | autocomplete.svelte.ts |
| `handleTriggerClick`         | trigger     | click            | select / menu          |
| `handleTriggerBlur`          | trigger     | blur             | select / menu          |
| `handleTriggerKeydown`       | trigger     | keydown          | select / menu          |
| `handleOptionMouseDown`      | option      | mousedown        | select.svelte.ts       |
| `handleOptionMouseEnter`     | option      | mouseenter       | select.svelte.ts       |
| `handleItemMouseDown`        | item        | mousedown        | menu.svelte.ts         |
| `handleItemMouseEnter`       | item        | mouseenter       | menu.svelte.ts         |
| `handleStarMouseEnter`       | star        | mouseenter       | rating.svelte.ts       |
| `handleStarClick`            | star        | click            | rating.svelte.ts       |
| `handleContainerMouseLeave`  | container   | mouseleave       | rating.svelte.ts       |
| `handleContainerKeydown`     | container   | keydown          | rating.svelte.ts       |

頁面層級元件中，handler 的「目標元素」可使用語義化名稱，如 `handleTagChange`、`handleRatingChange`、`handleSubmit`（來自 `form.svelte.ts`）。回調型 handler 不需加事件類型後綴。

### 4.7 程式碼編排規範

工廠函數內部以 `// ---` 作為視覺段落分隔符，依固定順序排列：

```ts
export function createXxx(options: XxxOptions) {
  // ① $state 宣告（含 JSDoc）
  let stateA = $state(...);
  let stateB = $state(...);

  // ② $derived 宣告（含 JSDoc）
  const derivedC = $derived(...);

  // ---

  // ③ 常數（如 options 列表）
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

  // ⑥ Return 物件（getter/setter 在前，handler 在後）
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
- 同一目標元素的 handler 不加分隔符（如 `handleTriggerClick` / `handleTriggerBlur` / `handleTriggerKeydown` 連續排列）。
- 不同目標元素的 handler 之間以 `// ---` 分隔。
- return 物件中：先 DOM ref getter/setter，再狀態 getter，最後 handler reference（與定義順序一致）。

### 4.8 handlers

永遠不得直接 return helper function，就算只包一層，也應該要包好後再 return：

```ts
function handleSomethingClick() {
    someHelper();
}
```
